import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { Client, SFTPWrapper } from 'ssh2';
import { ConnectionProfile, SFTPItem, LocalDirectoryResult } from '../domain/types';
import { CredentialBroker } from '../credential/credential-broker';
import { AuditService } from '../audit/audit-service';
import { TrustStore } from '../ssh/trust-store';
import { dbOperations } from '../storage/db';

export class SFTPManager {
  private static instance: SFTPManager;
  private sftpClients: Map<string, { client: Client; jumpClient?: Client; sftp: SFTPWrapper; profile: ConnectionProfile }> = new Map();

  private constructor() {}

  public static getInstance(): SFTPManager {
    if (!SFTPManager.instance) {
      SFTPManager.instance = new SFTPManager();
    }
    return SFTPManager.instance;
  }

  public async connectSFTP(sessionId: string, profile: ConnectionProfile): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const credBroker = CredentialBroker.getInstance();

      // Look up transient secret by sessionId, reference_id, or profile.id
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

      const clientConfig: any = {
        host: profile.hostname,
        port: profile.port || 22,
        username: profile.username,
        readyTimeout: 15000,
        tryKeyboard: true,
        hostVerifier: (keyBuffer: Buffer, cb: (accept: boolean) => void) => {
          const keyType = profile.hostname.includes('ed25519') ? 'ssh-ed25519' : 'ssh-rsa';
          const verifyRes = TrustStore.getInstance().verifyHostKey(
            profile.hostname,
            profile.port || 22,
            keyType,
            keyBuffer
          );
          if (verifyRes.status === 'trusted') {
            cb(true);
          } else {
            cb(false);
            AuditService.getInstance().logEvent({
              eventType: 'policy_denied',
              action: 'sftp_host_untrusted',
              outcome: 'denied',
              resourceType: 'host',
              resourceId: `${profile.hostname}:${profile.port || 22}`,
              reason: `SFTP host key verification rejected: status is ${verifyRes.status}. Please verify and trust host identity in SSH terminal first.`
            });
          }
        }
      };

      const passwordToUse = cred.password || transient;

      if (cred.authType === 'agent' && cred.agentSock) {
        clientConfig.agent = cred.agentSock;
      } else if (cred.authType === 'privateKey' && cred.privateKey) {
        clientConfig.privateKey = cred.privateKey;
      } else if (passwordToUse) {
        clientConfig.password = passwordToUse;
      } else {
        return reject(new Error(`Authentication required for ${profile.username}@${profile.hostname}. Please enter password.`));
      }

      client.on('keyboard-interactive', (_name, _inst, _lang, _prompts, finish) => {
        if (passwordToUse) {
          finish([passwordToUse]);
        } else {
          finish([]);
        }
      });

      // Jump Host handling
      if (profile.jump_host_profile_id && profile.jump_host_profile_id !== profile.id) {
        const allProfiles = dbOperations.getProfiles();
        const jumpProfile = allProfiles.find((p) => p.id === profile.jump_host_profile_id);

        if (jumpProfile) {
          const jumpClient = new Client();
          const jumpCred = credBroker.resolveCredential(jumpProfile.auth_reference, `sftp-jump-${jumpProfile.id}`, jumpProfile.id);
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
                  return reject(new Error(`Failed to tunnel SFTP via Jump Host (${jumpProfile.display_name}): ${err.message}`));
                }
                clientConfig.sock = stream;
                client.connect(clientConfig);
              }
            );
          });

          jumpClient.on('error', (err) => {
            reject(new Error(`Jump Host connection failed for SFTP (${jumpProfile.display_name}): ${err.message}`));
          });

          client.on('ready', () => {
            client.sftp((err, sftp) => {
              if (err) {
                jumpClient.end();
                client.end();
                return reject(err);
              }
              this.sftpClients.set(sessionId, { client, jumpClient, sftp, profile });
              resolve();
            });
          });

          client.on('error', (err) => {
            jumpClient.end();
            this.sftpClients.delete(sessionId);
            reject(err);
          });

          try {
            jumpClient.connect(jumpConfig);
          } catch (jErr) {
            reject(jErr);
          }
          return;
        }
      }

      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end();
            return reject(err);
          }
          this.sftpClients.set(sessionId, { client, sftp, profile });
          resolve();
        });
      });

      client.on('error', (err) => {
        this.sftpClients.delete(sessionId);
        reject(err);
      });

      client.connect(clientConfig);
    });
  }

  public disconnectSFTP(sessionId: string): void {
    const conn = this.sftpClients.get(sessionId);
    if (conn) {
      try {
        conn.sftp.end();
        conn.client.end();
        if (conn.jumpClient) conn.jumpClient.end();
      } catch (e) {
        // ignore
      }
      this.sftpClients.delete(sessionId);
    }
  }

  public async readRemoteFileText(sessionId: string, remotePath: string): Promise<{ path: string; content: string; size: number }> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const readStream = conn.sftp.createReadStream(remotePath);
      readStream.on('data', (d: Buffer) => chunks.push(d));
      readStream.on('error', (err: any) => reject(new Error(`Failed to read remote file: ${err.message}`)));
      readStream.on('close', () => {
        const fullBuf = Buffer.concat(chunks);
        resolve({
          path: remotePath,
          content: fullBuf.toString('utf-8'),
          size: fullBuf.length
        });
      });
    });
  }

  public async writeRemoteFileText(
    sessionId: string,
    remotePath: string,
    content: string,
    createBackup: boolean = true
  ): Promise<{ path: string; size: number; sha256: string }> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    // Create backup if requested and file already exists
    if (createBackup) {
      try {
        await new Promise<void>((resolve) => {
          conn.sftp.stat(remotePath, (err) => {
            if (err) return resolve(); // Doesn't exist yet, no backup needed
            const backupPath = `${remotePath}.bak-${Date.now()}`;
            // Copy or rename to backup
            const escapedSrc = remotePath.replace(/'/g, "'\\''");
            const escapedBak = backupPath.replace(/'/g, "'\\''");
            conn.client.exec(`cp '${escapedSrc}' '${escapedBak}'`, () => resolve());
          });
        });
      } catch (backupErr) {
        // Log backup warning but don't abort write
        console.warn(`[SFTP] Backup creation notice:`, backupErr);
      }
    }

    const buf = Buffer.from(content, 'utf-8');
    const res = await this.uploadBuffer(sessionId, buf, remotePath);

    AuditService.getInstance().logEvent({
      eventType: 'sftp_upload',
      action: 'edit_remote_file_saved',
      outcome: 'success',
      resourceType: 'file',
      resourceId: remotePath,
      metadata: {
        remotePath,
        size: buf.length,
        sha256: res.sha256,
        backupCreated: createBackup
      }
    });

    return {
      path: remotePath,
      size: buf.length,
      sha256: res.sha256
    };
  }

  public listLocalDirectory(dirPath: string): LocalDirectoryResult {
    let target = dirPath && dirPath.trim() ? dirPath.trim() : os.homedir();
    if (target === '~' || target.startsWith('~/') || target.startsWith('~\\')) {
      target = path.join(os.homedir(), target.slice(1));
    }

    let resolved = path.resolve(target);
    try {
      const real = fs.realpathSync(resolved);
      if (real && fs.existsSync(real)) resolved = real;
    } catch {
      try {
        const link = fs.readlinkSync(resolved);
        if (link) {
          const cand = path.isAbsolute(link) ? link : path.resolve(path.dirname(resolved), link);
          if (fs.existsSync(cand)) resolved = cand;
        }
      } catch {}
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(resolved, { withFileTypes: true });
    } catch (err: any) {
      throw new Error(`Access denied or invalid directory: ${err.message}`);
    }

    const items: SFTPItem[] = entries.map((entry) => {
      const full = path.join(resolved, entry.name);
      let targetPath = full;
      let size = 0;
      let mtime = 0;
      let isDir = entry.isDirectory();
      let isSymlink = entry.isSymbolicLink();

      if (isSymlink) {
        try {
          const real = fs.realpathSync(full);
          if (real) targetPath = real;
        } catch {
          try {
            const link = fs.readlinkSync(full);
            if (link) {
              const cand = path.isAbsolute(link) ? link : path.resolve(resolved, link);
              if (fs.existsSync(cand)) targetPath = cand;
            }
          } catch {}
        }
      }

      try {
        const stats = fs.statSync(targetPath);
        size = stats.size;
        mtime = Math.floor(stats.mtimeMs);
        isDir = stats.isDirectory();
      } catch (e) {
        try {
          const lstats = fs.lstatSync(full);
          size = lstats.size;
          mtime = Math.floor(lstats.mtimeMs);
          isDir = lstats.isDirectory();
        } catch {}
      }

      return {
        name: entry.name,
        path: targetPath,
        size,
        modifyTime: mtime,
        isDirectory: isDir,
        isSymlink,
        permissions: isDir ? '0755' : '0644'
      };
    });

    // Sort directories first, then alphabetical
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      items,
      currentPath: resolved,
      homeDir: os.homedir()
    };
  }

  public async listRemoteDirectory(sessionId: string, remotePath: string): Promise<SFTPItem[]> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    const targetDir = await new Promise<string>((resolve) => {
      if (!remotePath || remotePath === '.') {
        conn.sftp.realpath('.', (err, target) => {
          if (!err && target) {
            resolve(target);
          } else {
            resolve('/');
          }
        });
      } else {
        let sanitized = path.posix.normalize(remotePath);
        if (!sanitized.startsWith('/')) {
          sanitized = '/' + sanitized;
        }
        resolve(sanitized);
      }
    });

    return new Promise((resolve, reject) => {
      conn.sftp.readdir(targetDir, (err, list) => {
        if (err) return reject(err);

        const filteredList = list.filter((item) => item.filename !== '.' && item.filename !== '..');

        const items: SFTPItem[] = filteredList.map((item) => {
          const mode = item.attrs ? item.attrs.mode : 0;
          const isDir = Boolean(
            (item.longname && item.longname.startsWith('d')) ||
            (mode && (mode & 0o170000) === 0o040000) ||
            (mode && (mode & 0o040000) === 0o040000)
          );
          const isSymlink = Boolean(
            (item.longname && item.longname.startsWith('l')) ||
            (mode && (mode & 0o170000) === 0o120000)
          );
          const fullItemPath = path.posix.join(targetDir, item.filename);
          return {
            name: item.filename,
            path: fullItemPath,
            size: item.attrs ? item.attrs.size : 0,
            modifyTime: item.attrs && item.attrs.mtime ? item.attrs.mtime * 1000 : Date.now(),
            isDirectory: isDir,
            isSymlink,
            permissions: mode ? (mode & 0o777).toString(8).padStart(4, '0') : (isDir ? '0755' : '0644')
          };
        });

        // Sort directories first, then alphabetical
        items.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        resolve(items);
      });
    });
  }

  public async uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress?: (transferred: number, total: number, speed?: number) => void
  ): Promise<{ sha256: string }> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    if (!fs.existsSync(localPath)) throw new Error('Local file does not exist');
    const stat = fs.statSync(localPath);
    if (stat.isDirectory()) {
      return this.uploadDirectory(sessionId, localPath, remotePath, onProgress);
    }
    const totalBytes = stat.size;
    let lastTime = Date.now();
    let lastTransferred = 0;
    let smoothedSpeed = 0;

    return new Promise((resolve, reject) => {
      conn.sftp.fastPut(
        localPath,
        remotePath,
        {
          concurrency: 64,
          chunkSize: 32768,
          step: (transferred, _chunk, total) => {
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed >= 0.2) {
              const instant = (transferred - lastTransferred) / elapsed;
              smoothedSpeed = smoothedSpeed === 0 ? instant : (smoothedSpeed * 0.7 + instant * 0.3);
              lastTime = now;
              lastTransferred = transferred;
            }
            if (onProgress) onProgress(transferred, total || totalBytes, smoothedSpeed);
          }
        },
        (xferErr) => {
          if (xferErr) return reject(xferErr);

          try {
            const hash = crypto.createHash('sha256');
            const readStream = fs.createReadStream(localPath);
            readStream.on('data', (d) => hash.update(d));
            readStream.on('end', () => {
              const finalDigest = hash.digest('hex');
              AuditService.getInstance().logEvent({
                eventType: 'sftp_upload',
                action: 'upload_file_completed',
                outcome: 'success',
                resourceType: 'file',
                resourceId: remotePath,
                metadata: {
                  localPath,
                  remotePath,
                  bytes: totalBytes,
                  sha256: finalDigest,
                  host: conn.profile.hostname
                }
              });
              resolve({ sha256: finalDigest });
            });
            readStream.on('error', () => resolve({ sha256: 'completed' }));
          } catch {
            resolve({ sha256: 'completed' });
          }
        }
      );
    });
  }

  public async uploadDirectory(
    sessionId: string,
    localDir: string,
    remoteDir: string,
    onProgress?: (transferred: number, total: number, speed?: number) => void
  ): Promise<{ sha256: string }> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    // Create remote directory if it doesn't already exist
    await new Promise<void>((resolve) => {
      conn.sftp.mkdir(remoteDir, () => resolve());
    });

    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(localDir, entry.name);
      const dstPath = path.posix.join(remoteDir, entry.name);
      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          const s = fs.statSync(srcPath);
          isDir = s.isDirectory();
        } catch {}
      }

      if (isDir) {
        await this.uploadDirectory(sessionId, srcPath, dstPath, onProgress);
      } else {
        await this.uploadFile(sessionId, srcPath, dstPath, onProgress);
      }
    }

    return { sha256: 'directory' };
  }

  public async uploadBuffer(
    sessionId: string,
    buffer: Buffer,
    remotePath: string
  ): Promise<{ sha256: string }> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    const totalBytes = buffer.length;
    const localHash = crypto.createHash('sha256').update(buffer).digest('hex');

    return new Promise((resolve, reject) => {
      const writeStream = conn.sftp.createWriteStream(remotePath);
      writeStream.on('error', (err) => reject(err));
      writeStream.on('close', () => {
        AuditService.getInstance().logEvent({
          eventType: 'sftp_upload',
          action: 'upload_buffer_completed',
          outcome: 'success',
          resourceType: 'file',
          resourceId: remotePath,
          metadata: {
            remotePath,
            bytes: totalBytes,
            sha256: localHash,
            host: conn.profile.hostname
          }
        });
        resolve({ sha256: localHash });
      });
      writeStream.end(buffer);
    });
  }

  private getSessionPassword(sessionId: string, profile: ConnectionProfile): string | null {
    const credBroker = CredentialBroker.getInstance();
    let pwd = credBroker.getTransientSecret(sessionId);
    if (!pwd && profile.auth_reference?.reference_id) {
      pwd = credBroker.getTransientSecret(profile.auth_reference.reference_id);
    }
    if (!pwd) {
      pwd = credBroker.getTransientSecret(`profile:${profile.id}`);
    }
    return pwd;
  }

  public async executeSudoChmod(
    client: Client,
    remotePath: string,
    mode: string = '0644',
    password?: string | null
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Sudo elevation timed out (5s). Password may be incorrect or required.'));
        }
      }, 5000);

      const escaped = remotePath.replace(/'/g, "'\\''");
      const cmd = password
        ? `echo '${password.replace(/'/g, "'\\''")}' | sudo -S -p '' chmod ${mode} '${escaped}'`
        : `sudo -n chmod ${mode} '${escaped}'`;

      client.exec(cmd, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          settled = true;
          return reject(err);
        }

        let stderr = '';
        stream.stderr.on('data', (d: Buffer) => {
          stderr += d.toString();
        });

        stream.on('close', (code: number) => {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(stderr.trim() || `sudo chmod failed with code ${code}`));
          }
        });

        stream.end();
      });
    });
  }

  public async fixPermissions(sessionId: string, remotePath: string, mode: string = '0644'): Promise<boolean> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    const pwd = this.getSessionPassword(sessionId, conn.profile);
    await this.executeSudoChmod(conn.client, remotePath, mode, pwd);

    AuditService.getInstance().logEvent({
      eventType: 'sftp_download',
      action: 'sudo_chmod_permissions',
      outcome: 'success',
      resourceType: 'file',
      resourceId: remotePath,
      metadata: {
        remotePath,
        mode,
        host: conn.profile.hostname,
        username: conn.profile.username
      }
    });

    return true;
  }

  public async downloadFile(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress?: (transferred: number, total: number, speed: number) => void,
    sudoPassword?: string | null
  ): Promise<{ sha256: string }> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    // If explicit sudo password provided, store in broker for session
    if (sudoPassword) {
      CredentialBroker.getInstance().setTransientSecret(sessionId, sudoPassword);
    }

    const cleanup = (total: number) => {
      if (fs.existsSync(localPath)) {
        try {
          const s = fs.statSync(localPath);
          if (s.size === 0 || s.size < total) {
            fs.unlinkSync(localPath);
          }
        } catch {}
      }
    };

    return new Promise((resolve, reject) => {
      conn.sftp.stat(remotePath, async (err, stats) => {
        if (err) return reject(err);

        const isDir = Boolean(
          (stats.mode && (stats.mode & 0o170000) === 0o040000) ||
          (stats.mode && (stats.mode & 0o040000) === 0o040000)
        );
        if (isDir) {
          try {
            const res = await this.downloadDirectory(sessionId, remotePath, localPath, onProgress as any);
            return resolve(res);
          } catch (e) {
            return reject(e);
          }
        }

        const totalBytes = stats.size;
        let lastTime = Date.now();
        let lastTransferred = 0;
        let smoothedSpeed = 0;

        const performGet = (isRetry: boolean = false) => {
          conn.sftp.fastGet(
            remotePath,
            localPath,
            {
              concurrency: 64,
              chunkSize: 32768,
              step: (transferred, _chunk, total) => {
                const now = Date.now();
                const elapsed = (now - lastTime) / 1000;
                if (elapsed >= 0.2) {
                  const instant = (transferred - lastTransferred) / elapsed;
                  smoothedSpeed = smoothedSpeed === 0 ? instant : (smoothedSpeed * 0.7 + instant * 0.3);
                  lastTime = now;
                  lastTransferred = transferred;
                }
                if (onProgress) onProgress(transferred, total || totalBytes, smoothedSpeed);
              }
            },
            async (xferErr) => {
              if (xferErr) {
                const isPerm = xferErr.message && (
                  xferErr.message.toLowerCase().includes('permission denied') ||
                  (xferErr as any).code === 3
                );

                if (isPerm && !isRetry) {
                  try {
                    const pwd = sudoPassword || this.getSessionPassword(sessionId, conn.profile);
                    await this.executeSudoChmod(conn.client, remotePath, '0644', pwd);
                    cleanup(totalBytes);
                    // Sudo elevation succeeded; retry transfer with granted permissions
                    return performGet(true);
                  } catch (sudoErr) {
                    // Sudo elevation failed or password required
                  }
                }

                cleanup(totalBytes);
                return reject(xferErr);
              }

              try {
                const hash = crypto.createHash('sha256');
                const readStream = fs.createReadStream(localPath);
                readStream.on('data', (d) => hash.update(d));
                readStream.on('end', () => {
                  const finalDigest = hash.digest('hex');
                  AuditService.getInstance().logEvent({
                    eventType: 'sftp_download',
                    action: 'download_file_completed',
                    outcome: 'success',
                    resourceType: 'file',
                    resourceId: remotePath,
                    metadata: {
                      remotePath,
                      localPath,
                      bytes: totalBytes,
                      sha256: finalDigest,
                      host: conn.profile.hostname
                    }
                  });
                  resolve({ sha256: finalDigest });
                });
                readStream.on('error', () => resolve({ sha256: 'completed' }));
              } catch {
                resolve({ sha256: 'completed' });
              }
            }
          );
        };

        performGet(false);
      });
    });
  }

  public async downloadDirectory(
    sessionId: string,
    remoteDir: string,
    localDir: string,
    onProgress?: (transferred: number, total: number, speed?: number) => void
  ): Promise<{ sha256: string }> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const items = await this.listRemoteDirectory(sessionId, remoteDir);
    for (const item of items) {
      const srcPath = item.path;
      const dstPath = path.join(localDir, item.name);

      if (item.isDirectory) {
        await this.downloadDirectory(sessionId, srcPath, dstPath, onProgress);
      } else {
        await this.downloadFile(sessionId, srcPath, dstPath, onProgress);
      }
    }

    return { sha256: 'directory' };
  }

  public async deleteRemoteFile(sessionId: string, remotePath: string, isDirectory?: boolean): Promise<void> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    if (isDirectory) {
      return new Promise((resolve, reject) => {
        conn.sftp.rmdir(remotePath, async (err) => {
          if (err) {
            try {
              const pwd = this.getSessionPassword(sessionId, conn.profile);
              const escaped = remotePath.replace(/'/g, "'\\''");
              const cmd = pwd
                ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p '' rm -rf '${escaped}'`
                : `rm -rf '${escaped}'`;
              await new Promise<void>((res, rej) => {
                conn.client.exec(cmd, (execErr, stream) => {
                  if (execErr) return rej(execErr);
                  let stderr = '';
                  stream.stderr.on('data', (d) => { stderr += d.toString(); });
                  stream.on('close', (code) => {
                    if (code === 0) res();
                    else rej(new Error(stderr.trim() || `rm -rf failed with code ${code}`));
                  });
                  stream.end();
                });
              });
              AuditService.getInstance().logEvent({
                eventType: 'sftp_delete',
                action: 'delete_remote_directory_elevated',
                outcome: 'success',
                resourceType: 'directory',
                resourceId: remotePath
              });
              return resolve();
            } catch (fallbackErr) {
              return reject(err);
            }
          }
          AuditService.getInstance().logEvent({
            eventType: 'sftp_delete',
            action: 'delete_remote_directory',
            outcome: 'success',
            resourceType: 'directory',
            resourceId: remotePath
          });
          resolve();
        });
      });
    }

    return new Promise((resolve, reject) => {
      conn.sftp.unlink(remotePath, async (err) => {
        if (err) {
          try {
            const pwd = this.getSessionPassword(sessionId, conn.profile);
            const escaped = remotePath.replace(/'/g, "'\\''");
            const cmd = pwd
              ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p '' rm -f '${escaped}'`
              : `rm -f '${escaped}'`;
            await new Promise<void>((res, rej) => {
              conn.client.exec(cmd, (execErr, stream) => {
                if (execErr) return rej(execErr);
                let stderr = '';
                stream.stderr.on('data', (d) => { stderr += d.toString(); });
                stream.on('close', (code) => {
                  if (code === 0) res();
                  else rej(new Error(stderr.trim() || `sudo rm failed with code ${code}`));
                });
                stream.end();
              });
            });
            AuditService.getInstance().logEvent({
              eventType: 'sftp_delete',
              action: 'delete_remote_file_elevated',
              outcome: 'success',
              resourceType: 'file',
              resourceId: remotePath
            });
            return resolve();
          } catch (fallbackErr) {
            return reject(err);
          }
        }
        AuditService.getInstance().logEvent({
          eventType: 'sftp_delete',
          action: 'delete_remote_file',
          outcome: 'success',
          resourceType: 'file',
          resourceId: remotePath
        });
        resolve();
      });
    });
  }

  public deleteLocalItem(localPath: string): boolean {
    if (!localPath || !localPath.trim()) throw new Error('Local path cannot be empty');
    const target = path.resolve(localPath.trim());
    if (!fs.existsSync(target)) {
      throw new Error(`File or directory "${path.basename(target)}" does not exist`);
    }
    fs.rmSync(target, { recursive: true, force: true });
    AuditService.getInstance().logEvent({
      eventType: 'sftp_delete',
      action: 'delete_local_item',
      outcome: 'success',
      resourceType: 'local',
      resourceId: target
    });
    return true;
  }

  public createLocalDirectory(dirPath: string): boolean {
    if (!dirPath || !dirPath.trim()) throw new Error('Directory path cannot be empty');
    const target = path.resolve(dirPath.trim());
    if (fs.existsSync(target)) {
      throw new Error(`Directory "${path.basename(target)}" already exists`);
    }
    fs.mkdirSync(target, { recursive: true });
    return true;
  }

  public async createRemoteDirectory(sessionId: string, remotePath: string): Promise<void> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    return new Promise((resolve, reject) => {
      conn.sftp.mkdir(remotePath, async (err) => {
        if (err) {
          const isPerm = err.message && (
            err.message.toLowerCase().includes('permission denied') ||
            (err as any).code === 3
          );
          if (isPerm) {
            try {
              const pwd = this.getSessionPassword(sessionId, conn.profile);
              const escaped = remotePath.replace(/'/g, "'\\''");
              const cmd = pwd
                ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p '' mkdir -p '${escaped}'`
                : `sudo -n mkdir -p '${escaped}'`;
              await new Promise<void>((res, rej) => {
                conn.client.exec(cmd, (execErr, stream) => {
                  if (execErr) return rej(execErr);
                  let stderr = '';
                  stream.stderr.on('data', (d) => { stderr += d.toString(); });
                  stream.on('close', (code) => {
                    if (code === 0) res();
                    else rej(new Error(stderr.trim() || `sudo mkdir failed with code ${code}`));
                  });
                  stream.end();
                });
              });
              AuditService.getInstance().logEvent({
                eventType: 'sftp_mkdir',
                action: 'create_remote_directory_elevated',
                outcome: 'success',
                resourceType: 'directory',
                resourceId: remotePath
              });
              return resolve();
            } catch (sudoErr) {
              return reject(err);
            }
          }
          return reject(err);
        }
        AuditService.getInstance().logEvent({
          eventType: 'sftp_mkdir',
          action: 'create_remote_directory',
          outcome: 'success',
          resourceType: 'directory',
          resourceId: remotePath
        });
        resolve();
      });
    });
  }

  public copyLocalItem(srcPath: string, destDir: string): boolean {
    if (!srcPath || !destDir) throw new Error('Source and destination paths are required');
    const src = path.resolve(srcPath);
    if (!fs.existsSync(src)) throw new Error(`Source "${path.basename(src)}" not found`);
    const stat = fs.statSync(src);
    const baseName = path.basename(src);

    let targetName = baseName;
    let target = path.resolve(destDir, targetName);

    // If copying to same directory or target exists, find a unique name
    if (path.resolve(path.dirname(src)) === path.resolve(destDir) || fs.existsSync(target)) {
      const ext = stat.isDirectory() ? '' : path.extname(baseName);
      const nameWithoutExt = stat.isDirectory() ? baseName : path.basename(baseName, ext);
      let counter = 1;
      while (fs.existsSync(target)) {
        const suffix = counter === 1 ? ' (Copy)' : ` (Copy ${counter})`;
        targetName = `${nameWithoutExt}${suffix}${ext}`;
        target = path.resolve(destDir, targetName);
        counter++;
      }
    }

    if (stat.isDirectory()) {
      fs.cpSync(src, target, { recursive: true });
    } else {
      fs.copyFileSync(src, target);
    }

    AuditService.getInstance().logEvent({
      eventType: 'sftp_copy',
      action: 'copy_local_item',
      outcome: 'success',
      resourceType: stat.isDirectory() ? 'directory' : 'file',
      resourceId: target
    });
    return true;
  }

  public async copyRemoteItem(sessionId: string, srcPath: string, destDir: string): Promise<void> {
    const conn = this.sftpClients.get(sessionId);
    if (!conn) throw new Error('SFTP session not active');

    const baseName = path.posix.basename(srcPath);
    let target = path.posix.join(destDir, baseName);

    // If source parent is same as destDir, give it a copy name
    if (path.posix.dirname(srcPath) === destDir) {
      target = path.posix.join(destDir, `${baseName}_copy`);
    }

    const escapedSrc = srcPath.replace(/'/g, "'\\''");
    const escapedTarget = target.replace(/'/g, "'\\''");

    const execCp = (cmd: string) => {
      return new Promise<void>((resolve, reject) => {
        conn.client.exec(cmd, (err, stream) => {
          if (err) return reject(err);
          let stderr = '';
          stream.stderr.on('data', (d) => { stderr += d.toString(); });
          stream.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `cp exited with code ${code}`));
          });
          stream.end();
        });
      });
    };

    try {
      await execCp(`cp -r '${escapedSrc}' '${escapedTarget}'`);
    } catch (err: any) {
      const pwd = this.getSessionPassword(sessionId, conn.profile);
      const sudoCmd = pwd
        ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p '' cp -r '${escapedSrc}' '${escapedTarget}'`
        : `sudo -n cp -r '${escapedSrc}' '${escapedTarget}'`;
      await execCp(sudoCmd);
    }

    AuditService.getInstance().logEvent({
      eventType: 'sftp_copy',
      action: 'copy_remote_item',
      outcome: 'success',
      resourceType: 'remote',
      resourceId: target
    });
  }
}
