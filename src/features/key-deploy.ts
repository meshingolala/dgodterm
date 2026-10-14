import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { SSHManager } from '../ssh/ssh-client';
import { AuditService } from '../audit/audit-service';

export interface LocalPublicKey {
  path: string;
  filename: string;
  type: string;
  comment: string;
  fingerprint: string;
  publicKey: string;
}

export interface KeyOperationResult {
  profileId: string;
  success: boolean;
  alreadyPresent?: boolean;
  present?: boolean;
  removed?: boolean;
  error?: string;
}

function calculateFingerprint(keyBase64: string): string {
  try {
    const buf = Buffer.from(keyBase64, 'base64');
    const hash = crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '');
    return `SHA256:${hash}`;
  } catch {
    return 'SHA256:unknown';
  }
}

export const keyDeployHandlers = {
  'keys:list-local': async (): Promise<LocalPublicKey[]> => {
    const sshDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(sshDir)) return [];

    const files = fs.readdirSync(sshDir);
    const pubFiles = files.filter((f) => f.endsWith('.pub'));
    const keys: LocalPublicKey[] = [];

    for (const pf of pubFiles) {
      try {
        const fullPath = path.join(sshDir, pf);
        const content = fs.readFileSync(fullPath, 'utf8').trim();
        const parts = content.split(/\s+/);
        if (parts.length >= 2) {
          keys.push({
            path: fullPath,
            filename: pf,
            type: parts[0],
            comment: parts.slice(2).join(' ') || pf,
            fingerprint: calculateFingerprint(parts[1]),
            publicKey: content
          });
        }
      } catch {}
    }

    return keys;
  },

  'keys:deploy': async (payload: {
    profileIds: string[];
    publicKey: string;
  }): Promise<KeyOperationResult[]> => {
    const { profileIds, publicKey } = payload;
    const cleanKey = publicKey.trim().replace(/[\r\n]/g, '');
    if (!cleanKey) throw new Error('Public key content cannot be empty');

    const ssh = SSHManager.getInstance();
    const results: KeyOperationResult[] = [];

    for (const pid of profileIds) {
      try {
        // Deploy script: safely ensures ~/.ssh exists (700), authorized_keys exists (600), checks if key already present, appends if not
        const b64Key = Buffer.from(cleanKey).toString('base64');
        const script = `
K=$(printf '%s' '${b64Key}' | base64 -d)
mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
if grep -qxF "$K" ~/.ssh/authorized_keys 2>/dev/null; then
  echo "__ALREADY_EXISTS__"
else
  printf '%s\\n' "$K" >> ~/.ssh/authorized_keys
  echo "__INSTALLED__"
fi
`.trim();

        const { stdout, code } = await ssh.executeCommandOnTarget({ profileId: pid }, script);
        const already = stdout.includes('__ALREADY_EXISTS__');
        const installed = stdout.includes('__INSTALLED__');
        const success = code === 0 && (already || installed);

        results.push({
          profileId: pid,
          success,
          alreadyPresent: already,
          error: success ? undefined : 'Failed to write authorized_keys'
        });

        AuditService.getInstance().logEvent({
          eventType: 'service_action',
          action: 'ssh_key_deploy',
          outcome: success ? 'success' : 'failed',
          resourceType: 'authorized_keys',
          resourceId: pid,
          metadata: { profileId: pid, alreadyPresent: already }
        });
      } catch (err: any) {
        results.push({
          profileId: pid,
          success: false,
          error: err.message || 'Execution error'
        });
      }
    }

    return results;
  },

  'keys:verify': async (payload: {
    profileIds: string[];
    publicKey: string;
  }): Promise<KeyOperationResult[]> => {
    const { profileIds, publicKey } = payload;
    const cleanKey = publicKey.trim().replace(/[\r\n]/g, '');
    const ssh = SSHManager.getInstance();
    const results: KeyOperationResult[] = [];

    for (const pid of profileIds) {
      try {
        const b64Key = Buffer.from(cleanKey).toString('base64');
        const script = `
K=$(printf '%s' '${b64Key}' | base64 -d)
[ -f ~/.ssh/authorized_keys ] && grep -qxF "$K" ~/.ssh/authorized_keys 2>/dev/null && echo "__FOUND__" || echo "__NOT_FOUND__"
`.trim();
        const { stdout } = await ssh.executeCommandOnTarget({ profileId: pid }, script);
        const present = stdout.includes('__FOUND__');
        results.push({ profileId: pid, success: true, present });
      } catch (err: any) {
        results.push({ profileId: pid, success: false, present: false, error: err.message });
      }
    }

    return results;
  },

  'keys:revoke': async (payload: {
    profileIds: string[];
    publicKey: string;
  }): Promise<KeyOperationResult[]> => {
    const { profileIds, publicKey } = payload;
    const cleanKey = publicKey.trim().replace(/[\r\n]/g, '');
    const ssh = SSHManager.getInstance();
    const results: KeyOperationResult[] = [];

    for (const pid of profileIds) {
      try {
        const b64Key = Buffer.from(cleanKey).toString('base64');
        const script = `
K=$(printf '%s' '${b64Key}' | base64 -d)
if [ -f ~/.ssh/authorized_keys ]; then
  grep -vxF "$K" ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp 2>/dev/null &&
  mv -f ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys &&
  chmod 600 ~/.ssh/authorized_keys &&
  echo "__REMOVED__"
fi
`.trim();
        const { stdout, code } = await ssh.executeCommandOnTarget({ profileId: pid }, script);
        const removed = stdout.includes('__REMOVED__') && code === 0;
        results.push({ profileId: pid, success: removed, removed });

        AuditService.getInstance().logEvent({
          eventType: 'service_action',
          action: 'ssh_key_revoke',
          outcome: removed ? 'success' : 'failed',
          resourceType: 'authorized_keys',
          resourceId: pid,
          metadata: { profileId: pid, removed }
        });
      } catch (err: any) {
        results.push({ profileId: pid, success: false, removed: false, error: err.message });
      }
    }

    return results;
  }
};
