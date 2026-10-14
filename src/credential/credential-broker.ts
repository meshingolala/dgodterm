import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { CredentialReference } from '../domain/types';
import { dbOperations } from '../storage/db';

export class CredentialBroker {
  private static instance: CredentialBroker;
  private transientSecrets: Map<string, { value: string; expiresAt: number }> = new Map();

  private constructor() {}

  public static getInstance(): CredentialBroker {
    if (!CredentialBroker.instance) {
      CredentialBroker.instance = new CredentialBroker();
    }
    return CredentialBroker.instance;
  }

  public detectSshAgent(): { available: boolean; path: string | null; type: string } {
    if (process.platform === 'win32') {
      const namedPipe = '\\\\.\\pipe\\openssh-ssh-agent';
      // In Windows, OpenSSH agent typically listens on this named pipe
      return {
        available: true,
        path: namedPipe,
        type: 'OpenSSH Windows Agent'
      };
    } else {
      const sock = process.env.SSH_AUTH_SOCK;
      return {
        available: Boolean(sock),
        path: sock || null,
        type: 'Unix SSH Agent Socket'
      };
    }
  }

  public listStandardKeyFiles(): Array<{ path: string; label: string; exists: boolean }> {
    const home = os.homedir();
    const sshDir = path.join(home, '.ssh');
    const standardKeys = [
      { name: 'id_ed25519', label: 'Ed25519 Standard Key' },
      { name: 'id_rsa', label: 'RSA Standard Key' },
      { name: 'id_ecdsa', label: 'ECDSA Standard Key' }
    ];

    return standardKeys.map((k) => {
      const fullPath = path.join(sshDir, k.name);
      return {
        path: fullPath,
        label: k.label,
        exists: fs.existsSync(fullPath)
      };
    });
  }

  public setTransientSecret(key: string, secretValue: string, ttlMinutes: number = -1): void {
    const expiresAt = ttlMinutes > 0 ? Date.now() + ttlMinutes * 60 * 1000 : 0;
    this.transientSecrets.set(key, { value: secretValue, expiresAt });
  }

  public getTransientSecret(key: string): string | null {
    const entry = this.transientSecrets.get(key);
    if (!entry) return null;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.transientSecrets.delete(key);
      return null;
    }
    return entry.value;
  }

  public wipeTransientSecret(key: string): void {
    this.transientSecrets.delete(key);
  }

  public wipeAllTransientSecrets(): void {
    this.transientSecrets.clear();
  }

  public resolveCredential(ref: CredentialReference | null, sessionId: string, profileId?: string): {
    authType: 'agent' | 'privateKey' | 'password' | 'none';
    privateKey?: Buffer | string;
    passphrase?: string;
    password?: string;
    agentSock?: string;
  } {
    const findSecret = () => {
      let s = this.getTransientSecret(sessionId);
      if (!s && profileId) s = this.getTransientSecret(`profile:${profileId}`);
      if (!s && ref?.reference_id) s = this.getTransientSecret(ref.reference_id);
      return s;
    };

    if (!ref) {
      const transient = findSecret();
      if (transient) {
        return { authType: 'password', password: transient };
      }
      return { authType: 'none' };
    }

    if (ref.kind === 'ssh_agent') {
      const agentInfo = this.detectSshAgent();
      return {
        authType: 'agent',
        agentSock: agentInfo.path || undefined
      };
    }

    if (ref.kind === 'key_file_reference' && ref.key_path) {
      if (fs.existsSync(ref.key_path)) {
        const keyData = fs.readFileSync(ref.key_path);
        const transientPass = findSecret();
        return {
          authType: 'privateKey',
          privateKey: keyData,
          passphrase: transientPass || undefined
        };
      }
    }

    if (ref.kind === 'vault_reference' && ref.reference_id) {
      const cred = dbOperations.getVaultCredentialById(ref.reference_id, true);
      if (cred && cred.password) {
        return {
          authType: 'password',
          password: cred.password
        };
      }
    }

    if (ref.kind === 'transient_prompt') {
      const transient = findSecret();
      if (transient) {
        return { authType: 'password', password: transient };
      }
    }

    return { authType: 'none' };
  }
}
