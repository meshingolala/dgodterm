import crypto from 'crypto';
import { SSHManager } from '../ssh/ssh-client';
import { AuditService } from '../audit/audit-service';

export interface BatchPreviewItem {
  profileId: string;
  exists: boolean;
  currentSha256?: string;
  newSha256: string;
  identical: boolean;
  diff?: string;
  error?: string;
}

export interface BatchPushItem {
  profileId: string;
  success: boolean;
  sha256Verified: boolean;
  backupPath?: string;
  durationMs: number;
  error?: string;
}

function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function generateSimpleDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diffLines: string[] = ['--- current', '+++ new'];

  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max && diffLines.length < 200; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      diffLines.push(` ${o ?? ''}`);
    } else {
      if (o !== undefined) diffLines.push(`-${o}`);
      if (n !== undefined) diffLines.push(`+${n}`);
    }
  }
  return diffLines.join('\n');
}

export const batchPushHandlers = {
  'batch:preview': async (payload: {
    profileIds: string[];
    remotePath: string;
    content: string;
  }): Promise<BatchPreviewItem[]> => {
    const { profileIds, remotePath, content } = payload;
    const cleanPath = remotePath.replace(/['"`\n\r]/g, '');
    const newSha = computeSha256(content);
    const ssh = SSHManager.getInstance();

    const results: BatchPreviewItem[] = [];

    for (const pid of profileIds) {
      try {
        const checkCmd = `if [ -f '${cleanPath}' ]; then sha256sum '${cleanPath}' 2>/dev/null && head -n 150 '${cleanPath}' 2>/dev/null; else echo "__NO_FILE__"; fi`;
        const { stdout, code } = await ssh.executeCommandOnTarget({ profileId: pid }, checkCmd);

        if (stdout.includes('__NO_FILE__') || code !== 0) {
          results.push({
            profileId: pid,
            exists: false,
            newSha256: newSha,
            identical: false,
            diff: '+++ New file will be created'
          });
        } else {
          const lines = stdout.split('\n');
          const currentSha = (lines[0] || '').split(/\s+/)[0] || '';
          const oldContent = lines.slice(1).join('\n');
          const identical = currentSha === newSha;
          const diff = identical ? '(File is already identical)' : generateSimpleDiff(oldContent, content);

          results.push({
            profileId: pid,
            exists: true,
            currentSha256: currentSha,
            newSha256: newSha,
            identical,
            diff
          });
        }
      } catch (err: any) {
        results.push({
          profileId: pid,
          exists: false,
          newSha256: newSha,
          identical: false,
          error: err.message || 'Host unreachable'
        });
      }
    }

    return results;
  },

  'batch:push': async (payload: {
    profileIds: string[];
    remotePath: string;
    content: string;
    mode?: string;
    backup?: boolean;
    useSudo?: boolean;
  }): Promise<BatchPushItem[]> => {
    const { profileIds, remotePath, content, mode = '0644', backup = true, useSudo = false } = payload;
    const cleanPath = remotePath.replace(/['"`\n\r]/g, '');
    const cleanMode = mode.replace(/[^0-7]/g, '') || '0644';
    const targetSha = computeSha256(content);
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    const ssh = SSHManager.getInstance();

    const results: BatchPushItem[] = [];

    for (const pid of profileIds) {
      const startTime = Date.now();
      try {
        const tempPath = `/tmp/dgod_push_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const backupCmd = backup ? `[ -f '${cleanPath}' ] && cp -p '${cleanPath}' '${cleanPath}.bak.$(date +%s)' || true` : ':';
        const sudoPrefix = useSudo ? 'sudo -n ' : '';

        // Transfer via base64 decoding into temp, install to destination, verify sha256
        const script = `
printf '%s' '${b64}' | base64 -d > '${tempPath}' &&
${backupCmd} &&
${sudoPrefix}install -m ${cleanMode} '${tempPath}' '${cleanPath}' &&
rm -f '${tempPath}' &&
sha256sum '${cleanPath}' 2>/dev/null
`.trim();

        const { stdout, stderr, code } = await ssh.executeCommandOnTarget({ profileId: pid }, script);
        const verifiedSha = (stdout || '').trim().split(/\s+/)[0];
        const isVerified = verifiedSha === targetSha;
        const success = code === 0 && isVerified;

        results.push({
          profileId: pid,
          success,
          sha256Verified: isVerified,
          backupPath: backup ? `${cleanPath}.bak.*` : undefined,
          durationMs: Date.now() - startTime,
          error: success ? undefined : (stderr || 'Hash verification failed')
        });

        AuditService.getInstance().logEvent({
          eventType: 'sftp_upload',
          action: 'batch_file_push',
          outcome: success ? 'success' : 'failed',
          resourceType: 'remote_file',
          resourceId: cleanPath,
          metadata: { profileId: pid, sha256: targetSha, success, durationMs: Date.now() - startTime }
        });
      } catch (err: any) {
        results.push({
          profileId: pid,
          success: false,
          sha256Verified: false,
          durationMs: Date.now() - startTime,
          error: err.message || 'Execution error'
        });
      }
    }

    return results;
  }
};
