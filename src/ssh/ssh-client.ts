import { Client, ClientChannel } from 'ssh2';
import { ConnectionProfile } from '../domain/types';
import { TrustStore, HostVerificationResult } from './trust-store';
import { CredentialBroker } from '../credential/credential-broker';
import { PolicyEngine } from '../policy/policy-engine';
import { AuditService } from '../audit/audit-service';
import { dbOperations } from '../storage/db';
import { parseOsReleaseOutput } from './os-detector';

export interface SSHSessionCallbacks {
  onData: (data: string) => void;
  onClose: (code: number, signal?: string) => void;
  onError: (err: Error) => void;
  onHostVerificationRequired: (result: HostVerificationResult) => void;
  onPasswordRequired: (prompt: string) => void;
  onOsFlavorDetected?: (profileId: string, flavor: string, osName: string) => void;
}

interface ActiveSession {
  client: Client;
  jumpClient?: Client;
  channel?: ClientChannel;
  profile: ConnectionProfile;
  cols: number;
  rows: number;
  callbacks: SSHSessionCallbacks;
  pendingHostCallback?: (accept: boolean) => void;
  pendingAuthFinish?: (responses: string[]) => void;
}

export class SSHManager {
  private static instance: SSHManager;
  private sessions: Map<string, ActiveSession> = new Map();

  private constructor() {}

  public static getInstance(): SSHManager {
    if (!SSHManager.instance) {
      SSHManager.instance = new SSHManager();
    }
    return SSHManager.instance;
  }

  public connectSession(
    sessionId: string,
    profile: ConnectionProfile,
    cols: number,
    rows: number,
    callbacks: SSHSessionCallbacks
  ): void {
    // 1. Validate connection against policy
    const policyResult = PolicyEngine.getInstance().validateConnection(profile);
    if (!policyResult.allowed) {
      AuditService.getInstance().logEvent({
        eventType: 'policy_denied',
        action: 'ssh_connect_blocked_by_policy',
        outcome: 'denied',
        resourceType: 'profile',
        resourceId: profile.id,
        reason: policyResult.reason
      });
      callbacks.onError(new Error(policyResult.reason));
      return;
    }

    const client = new Client();
    this.sessions.set(sessionId, {
      client,
      profile,
      cols,
      rows,
      callbacks
    });

    const credBroker = CredentialBroker.getInstance();
    let transient = credBroker.getTransientSecret(sessionId);
    if (!transient && profile.auth_reference?.reference_id) {
      transient = credBroker.getTransientSecret(profile.auth_reference.reference_id);
    }
    if (!transient && profile.id) {
      transient = credBroker.getTransientSecret(`profile:${profile.id}`);
    }
    if (transient) {
      credBroker.setTransientSecret(sessionId, transient);
    }

    const cred = credBroker.resolveCredential(profile.auth_reference, sessionId);

    // If profile has transient_prompt or no credential and no transient password yet, ask user!
    if (
      (profile.auth_reference?.kind === 'transient_prompt' || cred.authType === 'none') &&
      !transient
    ) {
      callbacks.onPasswordRequired(`Enter password for ${profile.username}@${profile.hostname}:`);
      return;
    }

    const clientConfig: any = {
      host: profile.hostname,
      port: profile.port || 22,
      username: profile.username,
      keepaliveInterval: (profile.ssh_options?.keepalive_interval ?? 30) * 1000,
      readyTimeout: 20000,
      tryKeyboard: true,
      hostVerifier: (keyBuffer: Buffer, verifyCallback: (accept: boolean) => void) => {
        const keyType = profile.hostname.includes('ed25519') ? 'ssh-ed25519' : 'ssh-rsa';
        const verifyRes = TrustStore.getInstance().verifyHostKey(
          profile.hostname,
          profile.port,
          keyType,
          keyBuffer
        );

        if (verifyRes.status === 'trusted') {
          verifyCallback(true);
        } else {
          const s = this.sessions.get(sessionId);
          if (s) {
            s.pendingHostCallback = verifyCallback;
          }
          callbacks.onHostVerificationRequired(verifyRes);
        }
      }
    };

    if (cred.authType === 'agent' && cred.agentSock) {
      clientConfig.agent = cred.agentSock;
    } else if (cred.authType === 'privateKey' && cred.privateKey) {
      clientConfig.privateKey = cred.privateKey;
      if (cred.passphrase) {
        clientConfig.passphrase = cred.passphrase;
      }
    } else if (cred.authType === 'password' && cred.password) {
      clientConfig.password = cred.password;
    } else {
      const transient = credBroker.getTransientSecret(sessionId);
      if (transient) {
        clientConfig.password = transient;
      }
    }

    client.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      if (!prompts || prompts.length === 0) {
        finish([]);
        return;
      }
      let transient = credBroker.getTransientSecret(sessionId);
      if (!transient && profile.id) {
        transient = credBroker.getTransientSecret(`profile:${profile.id}`);
      }
      if (transient) {
        finish(prompts.map(() => transient!));
      } else {
        const s = this.sessions.get(sessionId);
        if (s) {
          s.pendingAuthFinish = finish;
        }
        const promptLabel = prompts[0]?.prompt || 'Password:';
        callbacks.onPasswordRequired(promptLabel);
      }
    });

    client.on('ready', () => {
      AuditService.getInstance().logEvent({
        eventType: 'session_connect',
        action: 'ssh_session_opened',
        outcome: 'success',
        resourceType: 'host',
        resourceId: `${profile.hostname}:${profile.port}`,
        metadata: {
          username: profile.username,
          profileId: profile.id,
          displayName: profile.display_name
        }
      });

      dbOperations.updateProfileLastConnected(profile.id);

      // Automatic Linux Distro / Flavour Detection (detects on login and updates host icon)
      this.detectOsFlavor(client, profile.id, (flavor, name) => {
        callbacks.onOsFlavorDetected?.(profile.id, flavor, name);
      });

      client.shell(
        {
          term: profile.ssh_options?.terminal_type || 'xterm-256color',
          cols,
          rows
        },
        (err, channel) => {
          if (err) {
            callbacks.onError(err);
            return;
          }

          const s = this.sessions.get(sessionId);
          if (s) {
            s.channel = channel;
          }

          channel.on('data', (chunk: Buffer) => {
            callbacks.onData(chunk.toString('utf-8'));
          });

          channel.on('close', (code: number, signal?: string) => {
            callbacks.onClose(code, signal);
            this.disconnectSession(sessionId);
          });
        }
      );
    });

    client.on('error', (err: any) => {
      if (err.level === 'client-authentication' || (err.message && err.message.includes('authentication'))) {
        callbacks.onPasswordRequired(`Authentication failed for ${profile.username}@${profile.hostname}. Please enter password:`);
        return;
      }

      AuditService.getInstance().logEvent({
        eventType: 'session_connect',
        action: 'ssh_session_failed',
        outcome: 'failed',
        resourceType: 'host',
        resourceId: `${profile.hostname}:${profile.port}`,
        reason: err.message
      });
      callbacks.onError(err);
    });

    client.on('close', () => {
      callbacks.onClose(0);
      this.disconnectSession(sessionId);
    });

    // Check if Jump Host / Bastion tunneling is configured
    if (profile.jump_host_profile_id && profile.jump_host_profile_id !== profile.id) {
      const allProfiles = dbOperations.getProfiles();
      const jumpProfile = allProfiles.find((p) => p.id === profile.jump_host_profile_id);

      if (jumpProfile) {
        const jumpClient = new Client();
        const activeEntry = this.sessions.get(sessionId);
        if (activeEntry) {
          activeEntry.jumpClient = jumpClient;
        }

        const jumpCred = credBroker.resolveCredential(jumpProfile.auth_reference, `jump-${sessionId}`, jumpProfile.id);
        let jumpTransient = credBroker.getTransientSecret(jumpProfile.id);
        if (!jumpTransient && jumpProfile.auth_reference?.reference_id) {
          jumpTransient = credBroker.getTransientSecret(jumpProfile.auth_reference.reference_id);
        }
        const jumpPassword = jumpCred.password || jumpTransient;

        const jumpConfig: any = {
          host: jumpProfile.hostname,
          port: jumpProfile.port || 22,
          username: jumpProfile.username,
          readyTimeout: 15000,
          tryKeyboard: true,
          hostVerifier: (_k: Buffer, cb: (acc: boolean) => void) => cb(true)
        };

        if (jumpCred.authType === 'agent' && jumpCred.agentSock) jumpConfig.agent = jumpCred.agentSock;
        else if (jumpCred.authType === 'privateKey' && jumpCred.privateKey) jumpConfig.privateKey = jumpCred.privateKey;
        else if (jumpPassword) jumpConfig.password = jumpPassword;

        jumpClient.on('ready', () => {
          jumpClient.forwardOut(
            '127.0.0.1',
            0,
            profile.hostname,
            profile.port || 22,
            (err, stream) => {
              if (err) {
                jumpClient.end();
                callbacks.onError(new Error(`Failed to tunnel via Jump Host (${jumpProfile.display_name}): ${err.message}`));
                return;
              }
              clientConfig.sock = stream;
              try {
                client.connect(clientConfig);
              } catch (connErr: any) {
                callbacks.onError(connErr);
              }
            }
          );
        });

        jumpClient.on('error', (err) => {
          callbacks.onError(new Error(`Jump Host connection failed (${jumpProfile.display_name}): ${err.message}`));
        });

        try {
          jumpClient.connect(jumpConfig);
        } catch (jErr: any) {
          callbacks.onError(jErr);
        }
        return;
      }
    }

    try {
      client.connect(clientConfig);
    } catch (err: any) {
      callbacks.onError(err);
    }
  }

  public submitTransientPassword(
    sessionId: string,
    pass: string,
    ttlMinutes: number = -1,
    profileId?: string
  ): void {
    const credBroker = CredentialBroker.getInstance();
    credBroker.setTransientSecret(sessionId, pass, ttlMinutes);

    const s = this.sessions.get(sessionId);
    const profId = profileId || s?.profile?.id;
    if (profId) {
      credBroker.setTransientSecret(`profile:${profId}`, pass, ttlMinutes);
    }
    if (s?.profile?.auth_reference?.reference_id) {
      credBroker.setTransientSecret(s.profile.auth_reference.reference_id, pass, ttlMinutes);
    }

    if (s && s.pendingAuthFinish) {
      s.pendingAuthFinish([pass]);
      s.pendingAuthFinish = undefined;
    } else if (s) {
      // Re-trigger connect with the new transient password
      const { profile, cols, rows, callbacks } = s;
      try {
        if (s.jumpClient) s.jumpClient.end();
        s.client.end();
      } catch (e) {}
      this.connectSession(sessionId, profile, cols, rows, callbacks);
    }
  }

  public resolveHostVerification(sessionId: string, accept: boolean): void {
    const s = this.sessions.get(sessionId);
    if (s && s.pendingHostCallback) {
      s.pendingHostCallback(accept);
      s.pendingHostCallback = undefined;
    }
  }

  public sendData(sessionId: string, data: string): void {
    const s = this.sessions.get(sessionId);
    if (s && s.channel) {
      s.channel.write(data);
    }
  }

  public broadcastData(sessionIds: string[], data: string): { deliveredCount: number } {
    let count = 0;
    for (const id of sessionIds) {
      const s = this.sessions.get(id);
      if (s && s.channel) {
        s.channel.write(data);
        count++;
      }
    }
    return { deliveredCount: count };
  }

  public getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  private detectOsFlavor(
    client: Client,
    profileId: string,
    onDetected?: (flavor: string, osName: string) => void
  ): void {
    try {
      client.exec(
        'cat /etc/os-release 2>/dev/null || cat /usr/lib/os-release 2>/dev/null || cat /etc/*release 2>/dev/null || uname -s',
        (err, stream) => {
          if (err) return;
          let output = '';
          stream.on('data', (d: Buffer) => {
            output += d.toString('utf-8');
          });
          stream.on('close', () => {
            const info = parseOsReleaseOutput(output);
            if (info && info.flavor) {
              dbOperations.updateProfileOsFlavor(profileId, info.flavor, info.name);
              onDetected?.(info.flavor, info.name);
            }
          });
        }
      );
    } catch (e) {
      // Non-fatal background detection
    }
  }

  public async executeCommand(sessionId: string, cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error('SSH session not found');

    return new Promise((resolve, reject) => {
      s.client.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        stream.on('data', (d: Buffer) => {
          stdout += d.toString('utf-8');
        });
        stream.stderr.on('data', (d: Buffer) => {
          stderr += d.toString('utf-8');
        });
        stream.on('close', (code: number) => {
          resolve({ stdout, stderr, code });
        });
      });
    });
  }

  public async executeCommandOnTarget(
    target: { sessionId?: string; profileId?: string },
    cmd: string
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    // 1. Try reusing active session if available
    if (target.sessionId && this.sessions.has(target.sessionId)) {
      try {
        return await this.executeCommand(target.sessionId, cmd);
      } catch (sessionExecErr: any) {
        console.warn(`[SSHManager] Active session exec failed (${sessionExecErr.message}), falling back to direct connection.`);
      }
    }

    if (!target.profileId) {
      throw new Error('Target must specify either an active sessionId or profileId');
    }

    const profiles = dbOperations.getProfiles();
    const profile = profiles.find((p) => p.id === target.profileId);
    if (!profile) throw new Error(`Profile not found for ID: ${target.profileId}`);

    for (const [_sId, s] of this.sessions.entries()) {
      if (s.profile.id === profile.id && _sId !== target.sessionId) {
        try {
          return await this.executeCommand(_sId, cmd);
        } catch (e) {}
      }
    }

    const client = new Client();
    const credBroker = CredentialBroker.getInstance();
    let transient = credBroker.getTransientSecret(profile.id);
    if (!transient && profile.auth_reference?.reference_id) {
      transient = credBroker.getTransientSecret(profile.auth_reference.reference_id);
    }
    const cred = credBroker.resolveCredential(profile.auth_reference, undefined, profile.id);

    const clientConfig: any = {
      host: profile.hostname,
      port: profile.port || 22,
      username: profile.username,
      readyTimeout: 15000,
      tryKeyboard: true,
      hostVerifier: (_k: Buffer, cb: (a: boolean) => void) => cb(true)
    };

    if (cred.authType === 'agent' && cred.agentSock) {
      clientConfig.agent = cred.agentSock;
    } else if (cred.authType === 'privateKey' && cred.privateKey) {
      clientConfig.privateKey = cred.privateKey;
      if (cred.passphrase) clientConfig.passphrase = cred.passphrase;
    } else if (cred.password || transient) {
      clientConfig.password = cred.password || transient;
    }

    // Keyboard-interactive password fallback
    const resolvedPassword = cred.password || transient;
    if (resolvedPassword) {
      client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        finish(prompts.map(() => resolvedPassword));
      });
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let jumpClient: Client | null = null;

      const cleanup = () => {
        if (!isSettled) {
          isSettled = true;
          try { client.end(); } catch (e) {}
          if (jumpClient) {
            try { jumpClient.end(); } catch (e) {}
          }
        }
      };

      const startExec = () => {
        client.exec(cmd, (err, stream) => {
          if (err) {
            cleanup();
            return reject(new Error(`Failed to execute command: ${err.message}`));
          }
          let stdout = '';
          let stderr = '';
          stream.on('data', (d: Buffer) => {
            stdout += d.toString('utf-8');
          });
          stream.stderr.on('data', (d: Buffer) => {
            stderr += d.toString('utf-8');
          });
          stream.on('close', (code: number) => {
            cleanup();
            resolve({ stdout, stderr, code });
          });
        });
      };

      client.on('ready', () => {
        startExec();
      });

      client.on('error', (err) => {
        cleanup();
        reject(new Error(`SSH connection failed to ${profile.hostname}: ${err.message}`));
      });

      // Jump Host Support for standalone execution
      if (profile.jump_host_profile_id && profile.jump_host_profile_id !== profile.id) {
        const allProfiles = dbOperations.getProfiles();
        const jumpProfile = allProfiles.find((p) => p.id === profile.jump_host_profile_id);

        if (jumpProfile) {
          jumpClient = new Client();
          const jumpCred = credBroker.resolveCredential(jumpProfile.auth_reference, undefined, jumpProfile.id);
          let jumpTransient = credBroker.getTransientSecret(jumpProfile.id);
          if (!jumpTransient && jumpProfile.auth_reference?.reference_id) {
            jumpTransient = credBroker.getTransientSecret(jumpProfile.auth_reference.reference_id);
          }
          const jumpPassword = jumpCred.password || jumpTransient;

          const jumpConfig: any = {
            host: jumpProfile.hostname,
            port: jumpProfile.port || 22,
            username: jumpProfile.username,
            readyTimeout: 15000,
            tryKeyboard: true,
            hostVerifier: (_k: Buffer, cb: (acc: boolean) => void) => cb(true)
          };

          if (jumpCred.authType === 'agent' && jumpCred.agentSock) jumpConfig.agent = jumpCred.agentSock;
          else if (jumpCred.authType === 'privateKey' && jumpCred.privateKey) jumpConfig.privateKey = jumpCred.privateKey;
          else if (jumpPassword) jumpConfig.password = jumpPassword;

          if (jumpPassword) {
            jumpClient.on('keyboard-interactive', (_n, _i, _l, prompts, finish) => finish(prompts.map(() => jumpPassword)));
          }

          jumpClient.on('ready', () => {
            jumpClient!.forwardOut('127.0.0.1', 0, profile.hostname, profile.port || 22, (err, stream) => {
              if (err) {
                cleanup();
                return reject(new Error(`Failed to tunnel via Jump Host (${jumpProfile.display_name}): ${err.message}`));
              }
              clientConfig.sock = stream;
              try {
                client.connect(clientConfig);
              } catch (e: any) {
                cleanup();
                reject(e);
              }
            });
          });

          jumpClient.on('error', (err) => {
            cleanup();
            reject(new Error(`Jump Host connection failed (${jumpProfile.display_name}): ${err.message}`));
          });

          try {
            jumpClient.connect(jumpConfig);
          } catch (e: any) {
            cleanup();
            reject(e);
          }
          return;
        }
      }

      // Direct connection (no jump host)
      try {
        client.connect(clientConfig);
      } catch (e) {
        cleanup();
        reject(e);
      }
    });
  }

  public resize(sessionId: string, cols: number, rows: number): void {
    const s = this.sessions.get(sessionId);
    if (s && s.channel) {
      s.cols = cols;
      s.rows = rows;
      s.channel.setWindow(rows, cols, 0, 0);
    }
  }

  public disconnectSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (s) {
      try {
        if (s.channel) s.channel.close();
        s.client.end();
        if (s.jumpClient) s.jumpClient.end();
      } catch (e) {}
      this.sessions.delete(sessionId);
      CredentialBroker.getInstance().wipeTransientSecret(sessionId);

      AuditService.getInstance().logEvent({
        eventType: 'session_disconnect',
        action: 'ssh_session_closed',
        outcome: 'success',
        resourceType: 'profile',
        resourceId: s.profile.id
      });
    }
  }
}
