import net from 'net';
import { Client } from 'ssh2';
import { PortForwardConfig, ConnectionProfile } from '../domain/types';
import { dbOperations } from '../storage/db';
import { CredentialBroker } from '../credential/credential-broker';
import { AuditService } from '../audit/audit-service';

interface ActiveTunnel {
  config: PortForwardConfig;
  sshClient: Client;
  localServer?: net.Server;
  activeSockets: Set<net.Socket>;
  activeConnections: number;
  bytesTransferred: number;
  status: 'running' | 'stopped' | 'error';
  errorMessage?: string;
}

export class TunnelManager {
  private static instance: TunnelManager;
  private activeTunnels: Map<string, ActiveTunnel> = new Map();

  private constructor() {}

  public static getInstance(): TunnelManager {
    if (!TunnelManager.instance) {
      TunnelManager.instance = new TunnelManager();
    }
    return TunnelManager.instance;
  }

  public getTunnelStatuses(): Record<string, {
    status: 'running' | 'stopped' | 'error';
    activeConnections: number;
    bytesTransferred: number;
    errorMessage?: string;
  }> {
    const res: Record<string, any> = {};
    const all = dbOperations.getTunnels();
    for (const t of all) {
      const active = this.activeTunnels.get(t.id);
      if (active) {
        res[t.id] = {
          status: active.status,
          activeConnections: active.activeConnections,
          bytesTransferred: active.bytesTransferred,
          errorMessage: active.errorMessage
        };
      } else {
        res[t.id] = {
          status: 'stopped',
          activeConnections: 0,
          bytesTransferred: 0
        };
      }
    }
    return res;
  }

  public async startTunnel(tunnelId: string): Promise<boolean> {
    const tunnels = dbOperations.getTunnels();
    const config = tunnels.find((t) => t.id === tunnelId);
    if (!config) {
      throw new Error(`Tunnel configuration not found: ${tunnelId}`);
    }

    if (this.activeTunnels.has(tunnelId)) {
      const existing = this.activeTunnels.get(tunnelId);
      if (existing && existing.status === 'running') {
        return true; // Already running
      }
      this.stopTunnel(tunnelId);
    }

    const profiles = dbOperations.getProfiles();
    const profile = profiles.find((p) => p.id === config.profileId);
    if (!profile) {
      throw new Error(`Target profile associated with tunnel not found: ${config.profileId}`);
    }

    return new Promise((resolve, reject) => {
      const sshClient = new Client();
      const activeEntry: ActiveTunnel = {
        config,
        sshClient,
        activeSockets: new Set(),
        activeConnections: 0,
        bytesTransferred: 0,
        status: 'stopped'
      };

      this.activeTunnels.set(tunnelId, activeEntry);

      const credBroker = CredentialBroker.getInstance();
      let transient = credBroker.getTransientSecret(config.profileId);
      if (!transient && profile.auth_reference?.reference_id) {
        transient = credBroker.getTransientSecret(profile.auth_reference.reference_id);
      }
      if (!transient && profile.id) {
        transient = credBroker.getTransientSecret(`profile:${profile.id}`);
      }

      const cred = credBroker.resolveCredential(profile.auth_reference, `tunnel-${config.id}`, profile.id);
      const passwordToUse = cred.password || transient;

      const clientConfig: any = {
        host: profile.hostname,
        port: profile.port || 22,
        username: profile.username,
        readyTimeout: 15000,
        tryKeyboard: true,
        hostVerifier: (_key: Buffer, cb: (accept: boolean) => void) => cb(true)
      };

      if (cred.authType === 'agent' && cred.agentSock) {
        clientConfig.agent = cred.agentSock;
      } else if (cred.authType === 'privateKey' && cred.privateKey) {
        clientConfig.privateKey = cred.privateKey;
      } else if (passwordToUse) {
        clientConfig.password = passwordToUse;
      }

      sshClient.on('keyboard-interactive', (_name, _inst, _lang, _prompts, finish) => {
        if (passwordToUse) {
          finish([passwordToUse]);
        } else {
          finish([]);
        }
      });

      sshClient.on('ready', () => {
        activeEntry.status = 'running';

        try {
          if (config.type === 'local') {
            this.setupLocalForward(activeEntry, resolve, reject);
          } else if (config.type === 'remote') {
            this.setupRemoteForward(activeEntry, resolve, reject);
          } else if (config.type === 'dynamic') {
            this.setupDynamicForward(activeEntry, resolve, reject);
          } else {
            throw new Error(`Unsupported tunnel type: ${config.type}`);
          }

          AuditService.getInstance().logEvent({
            eventType: 'tunnel_started',
            action: 'start_tunnel',
            outcome: 'success',
            resourceType: 'tunnel',
            resourceId: tunnelId,
            metadata: {
              name: config.name,
              type: config.type,
              localPort: config.localPort,
              remoteHost: config.remoteHost,
              remotePort: config.remotePort
            }
          });
        } catch (err: any) {
          activeEntry.status = 'error';
          activeEntry.errorMessage = err.message;
          reject(err);
        }
      });

      sshClient.on('error', (err) => {
        activeEntry.status = 'error';
        activeEntry.errorMessage = err.message;
        reject(err);
      });

      sshClient.on('close', () => {
        this.stopTunnel(tunnelId);
      });

      try {
        sshClient.connect(clientConfig);
      } catch (err: any) {
        activeEntry.status = 'error';
        activeEntry.errorMessage = err.message;
        reject(err);
      }
    });
  }

  private setupLocalForward(
    active: ActiveTunnel,
    resolve: (val: boolean) => void,
    reject: (err: any) => void
  ) {
    const { config, sshClient } = active;
    const server = net.createServer((sock) => {
      active.activeSockets.add(sock);
      active.activeConnections++;

      sock.on('data', (d) => {
        active.bytesTransferred += d.length;
      });

      sshClient.forwardOut(
        '127.0.0.1',
        sock.remotePort || 0,
        config.remoteHost || '127.0.0.1',
        config.remotePort || 80,
        (err, stream) => {
          if (err) {
            sock.destroy();
            return;
          }
          stream.on('data', (d) => {
            active.bytesTransferred += d.length;
          });
          sock.pipe(stream).pipe(sock);

          const cleanup = () => {
            active.activeSockets.delete(sock);
            active.activeConnections = Math.max(0, active.activeConnections - 1);
          };
          sock.on('close', cleanup);
          stream.on('close', cleanup);
          sock.on('error', cleanup);
          stream.on('error', cleanup);
        }
      );
    });

    server.on('error', (err) => {
      active.status = 'error';
      active.errorMessage = err.message;
      reject(err);
    });

    const bindHost = config.localHost || '127.0.0.1';
    server.listen(config.localPort, bindHost, () => {
      active.localServer = server;
      resolve(true);
    });
  }

  private setupRemoteForward(
    active: ActiveTunnel,
    resolve: (val: boolean) => void,
    reject: (err: any) => void
  ) {
    const { config, sshClient } = active;
    const remoteHost = config.remoteHost || '127.0.0.1';
    const remotePort = config.remotePort || 8080;

    sshClient.forwardIn(remoteHost, remotePort, (err) => {
      if (err) {
        active.status = 'error';
        active.errorMessage = err.message;
        return reject(err);
      }

      (sshClient as any).on('tcpip', (info: any, accept: any, _reject: any) => {
        active.activeConnections++;
        const stream = accept();
        const localSock = net.connect(config.localPort, config.localHost || '127.0.0.1');

        active.activeSockets.add(localSock);

        stream.on('data', (d: Buffer) => {
          active.bytesTransferred += d.length;
        });
        localSock.on('data', (d: Buffer) => {
          active.bytesTransferred += d.length;
        });

        localSock.pipe(stream).pipe(localSock);

        const cleanup = () => {
          active.activeSockets.delete(localSock);
          active.activeConnections = Math.max(0, active.activeConnections - 1);
        };
        localSock.on('close', cleanup);
        stream.on('close', cleanup);
        localSock.on('error', cleanup);
        stream.on('error', cleanup);
      });

      resolve(true);
    });
  }

  private setupDynamicForward(
    active: ActiveTunnel,
    resolve: (val: boolean) => void,
    reject: (err: any) => void
  ) {
    const { config, sshClient } = active;
    const server = net.createServer((sock) => {
      active.activeSockets.add(sock);
      active.activeConnections++;

      let handshaked = false;

      sock.on('data', (data: Buffer) => {
        active.bytesTransferred += data.length;

        if (!handshaked) {
          // SOCKS5 greeting: [VER (0x05), NMETHODS, METHODS...]
          if (data[0] !== 0x05) {
            sock.destroy();
            return;
          }
          // Accept NO AUTHENTICATION REQUIRED (0x00)
          sock.write(Buffer.from([0x05, 0x00]));
          handshaked = true;
          return;
        }

        // SOCKS5 request: [VER(0x05), CMD(0x01=CONNECT), RSV(0x00), ATYP, DST.ADDR, DST.PORT]
        if (data[0] === 0x05 && data[1] === 0x01) {
          let destHost = '';
          let destPort = 0;
          let offset = 4;
          const atyp = data[3];

          if (atyp === 0x01) {
            // IPv4
            destHost = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
            offset = 8;
          } else if (atyp === 0x03) {
            // Domain name
            const domainLen = data[4];
            destHost = data.subarray(5, 5 + domainLen).toString('utf8');
            offset = 5 + domainLen;
          } else if (atyp === 0x04) {
            // IPv6
            destHost = data.subarray(4, 20).toString('hex');
            offset = 20;
          } else {
            sock.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            sock.destroy();
            return;
          }

          destPort = data.readUInt16BE(offset);

          sshClient.forwardOut('127.0.0.1', sock.remotePort || 0, destHost, destPort, (err, stream) => {
            if (err) {
              sock.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0])); // Connection refused
              sock.destroy();
              return;
            }

            // Success reply: [0x05, 0x00 (SUCCESS), 0x00, 0x01, 0,0,0,0, 0,0]
            sock.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));

            stream.on('data', (d) => {
              active.bytesTransferred += d.length;
            });

            sock.pipe(stream).pipe(sock);

            const cleanup = () => {
              active.activeSockets.delete(sock);
              active.activeConnections = Math.max(0, active.activeConnections - 1);
            };
            sock.on('close', cleanup);
            stream.on('close', cleanup);
            sock.on('error', cleanup);
            stream.on('error', cleanup);
          });
        }
      });
    });

    server.on('error', (err) => {
      active.status = 'error';
      active.errorMessage = err.message;
      reject(err);
    });

    const bindHost = config.localHost || '127.0.0.1';
    server.listen(config.localPort, bindHost, () => {
      active.localServer = server;
      resolve(true);
    });
  }

  public stopTunnel(tunnelId: string): void {
    const active = this.activeTunnels.get(tunnelId);
    if (active) {
      active.status = 'stopped';
      active.activeSockets.forEach((s) => {
        try {
          s.destroy();
        } catch (e) {}
      });
      active.activeSockets.clear();
      active.activeConnections = 0;

      if (active.localServer) {
        try {
          active.localServer.close();
        } catch (e) {}
      }

      try {
        active.sshClient.end();
      } catch (e) {}

      this.activeTunnels.delete(tunnelId);

      AuditService.getInstance().logEvent({
        eventType: 'tunnel_stopped',
        action: 'stop_tunnel',
        outcome: 'success',
        resourceType: 'tunnel',
        resourceId: tunnelId,
        metadata: {
          name: active.config.name,
          bytesTransferred: active.bytesTransferred
        }
      });
    }
  }

  public stopAll(): void {
    const ids = Array.from(this.activeTunnels.keys());
    for (const id of ids) {
      this.stopTunnel(id);
    }
  }
}
