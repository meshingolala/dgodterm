import { SSHManager } from './ssh-client';
import { AuditService } from '../audit/audit-service';

export interface DiffLine {
  lineNumA?: number;
  lineNumB?: number;
  type: 'same' | 'added' | 'removed' | 'modified';
  contentA?: string;
  contentB?: string;
}

export interface ConfigDriftResult {
  pathOrCommand: string;
  hostAIdentifier: string;
  hostBIdentifier: string;
  identical: boolean;
  mismatchedLineCount: number;
  totalLinesA: number;
  totalLinesB: number;
  contentA: string;
  contentB: string;
  diffLines: DiffLine[];
  timestamp: string;
}

export class ConfigDriftService {
  private static instance: ConfigDriftService;

  private constructor() {}

  public static getInstance(): ConfigDriftService {
    if (!ConfigDriftService.instance) {
      ConfigDriftService.instance = new ConfigDriftService();
    }
    return ConfigDriftService.instance;
  }

  public async compareHosts(
    targetA: { sessionId?: string; profileId?: string; label?: string },
    targetB: { sessionId?: string; profileId?: string; label?: string },
    pathOrCommand: string
  ): Promise<ConfigDriftResult> {
    const ssh = SSHManager.getInstance();

    let execCmd = pathOrCommand.trim();
    if (execCmd.startsWith('/')) {
      // It's a file path
      const cleanPath = execCmd.replace(/["$`]/g, '');
      execCmd = `cat "${cleanPath}" 2>/dev/null || sudo cat "${cleanPath}" 2>/dev/null || echo "[Error: File not found or unreadable]"`;
    }

    // Run simultaneously on both targets
    const [resA, resB] = await Promise.all([
      ssh.executeCommandOnTarget(targetA, execCmd).catch((err) => ({ stdout: `[Execution Failed: ${err.message}]`, stderr: '', code: 1 })),
      ssh.executeCommandOnTarget(targetB, execCmd).catch((err) => ({ stdout: `[Execution Failed: ${err.message}]`, stderr: '', code: 1 }))
    ]);

    const contentA = (resA.stdout || '').replace(/\r\n/g, '\n');
    const contentB = (resB.stdout || '').replace(/\r\n/g, '\n');

    const linesA = contentA.split('\n');
    const linesB = contentB.split('\n');

    const diffLines: DiffLine[] = [];
    const maxLines = Math.max(linesA.length, linesB.length);
    let mismatchedCount = 0;

    for (let i = 0; i < maxLines; i++) {
      const lineA = linesA[i];
      const lineB = linesB[i];

      if (lineA !== undefined && lineB !== undefined) {
        if (lineA === lineB) {
          diffLines.push({
            lineNumA: i + 1,
            lineNumB: i + 1,
            type: 'same',
            contentA: lineA,
            contentB: lineB
          });
        } else {
          mismatchedCount++;
          diffLines.push({
            lineNumA: i + 1,
            lineNumB: i + 1,
            type: 'modified',
            contentA: lineA,
            contentB: lineB
          });
        }
      } else if (lineA !== undefined) {
        mismatchedCount++;
        diffLines.push({
          lineNumA: i + 1,
          type: 'removed',
          contentA: lineA
        });
      } else if (lineB !== undefined) {
        mismatchedCount++;
        diffLines.push({
          lineNumB: i + 1,
          type: 'added',
          contentB: lineB
        });
      }
    }

    const identical = mismatchedCount === 0;

    AuditService.getInstance().logEvent({
      eventType: 'configuration_drift_checked',
      action: 'compare_host_configurations',
      outcome: 'success',
      resourceType: 'configuration_file',
      resourceId: pathOrCommand,
      metadata: {
        hostA: targetA.label || targetA.profileId || targetA.sessionId,
        hostB: targetB.label || targetB.profileId || targetB.sessionId,
        identical,
        mismatchedLineCount: mismatchedCount
      }
    });

    return {
      pathOrCommand,
      hostAIdentifier: targetA.label || targetA.profileId || targetA.sessionId || 'Host A',
      hostBIdentifier: targetB.label || targetB.profileId || targetB.sessionId || 'Host B',
      identical,
      mismatchedLineCount: mismatchedCount,
      totalLinesA: linesA.length,
      totalLinesB: linesB.length,
      contentA,
      contentB,
      diffLines,
      timestamp: new Date().toISOString()
    };
  }
}
