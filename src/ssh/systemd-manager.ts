import { SSHManager } from './ssh-client';
import { AuditService } from '../audit/audit-service';

export interface SystemdUnitInfo {
  unit: string;
  load: string;
  active: 'active' | 'inactive' | 'failed' | string;
  sub: string;
  description: string;
}

export class SystemdManager {
  private static instance: SystemdManager;

  private constructor() {}

  public static getInstance(): SystemdManager {
    if (!SystemdManager.instance) {
      SystemdManager.instance = new SystemdManager();
    }
    return SystemdManager.instance;
  }

  public async listServices(target: { sessionId?: string; profileId?: string }): Promise<SystemdUnitInfo[]> {
    const ssh = SSHManager.getInstance();
    // Fetch all systemd services without pager
    const cmd = `systemctl list-units --type=service --all --no-legend --no-pager 2>/dev/null`;
    const { stdout } = await ssh.executeCommandOnTarget(target, cmd);

    const units: SystemdUnitInfo[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('●') || trimmed.startsWith('*')) {
        // Handle lines with bullet indicator
        const clean = trimmed.replace(/^[●*]\s+/, '');
        if (!clean) continue;
      }

      // Regex matching: UNIT LOAD ACTIVE SUB DESCRIPTION...
      // e.g. "nginx.service loaded active running A high performance web server"
      const match = trimmed.replace(/^[●*]\s+/, '').match(/^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/);
      if (match) {
        units.push({
          unit: match[1],
          load: match[2],
          active: match[3],
          sub: match[4],
          description: match[5] || match[1]
        });
      }
    }

    // Sort: failed units first, then active/running, then alphabetical
    units.sort((a, b) => {
      if (a.active === 'failed' && b.active !== 'failed') return -1;
      if (b.active === 'failed' && a.active !== 'failed') return 1;
      if (a.active === 'active' && b.active !== 'active') return -1;
      if (b.active === 'active' && a.active !== 'active') return 1;
      return a.unit.localeCompare(b.unit);
    });

    return units;
  }

  public async controlService(
    target: { sessionId?: string; profileId?: string },
    unit: string,
    action: 'start' | 'stop' | 'restart' | 'reload'
  ): Promise<{ success: boolean; output: string }> {
    const ssh = SSHManager.getInstance();
    // Sanitize unit name to prevent shell injection
    const cleanUnit = unit.replace(/[^a-zA-Z0-9_\-@.]/g, '');
    const cmd = `systemctl ${action} ${cleanUnit} 2>&1 || sudo systemctl ${action} ${cleanUnit} 2>&1`;

    const { stdout, stderr, code } = await ssh.executeCommandOnTarget(target, cmd);
    const output = (stdout + '\n' + stderr).trim();
    const success = code === 0;

    AuditService.getInstance().logEvent({
      eventType: 'service_action',
      action: `systemd_${action}_service`,
      outcome: success ? 'success' : 'failed',
      resourceType: 'systemd_unit',
      resourceId: cleanUnit,
      metadata: { action, output, code }
    });

    return { success, output };
  }

  public async getJournalLogs(
    target: { sessionId?: string; profileId?: string },
    unit: string,
    lines = 100
  ): Promise<string> {
    const ssh = SSHManager.getInstance();
    const cleanUnit = unit.replace(/[^a-zA-Z0-9_\-@.]/g, '');
    const numLines = Math.min(Math.max(10, lines), 500);

    const cmd = `journalctl -u ${cleanUnit} -n ${numLines} --no-pager 2>&1 || systemctl status ${cleanUnit} -n ${numLines} --no-pager 2>&1`;
    const { stdout, stderr } = await ssh.executeCommandOnTarget(target, cmd);

    return (stdout || stderr || 'No journal logs available for this unit.').trim();
  }
}
