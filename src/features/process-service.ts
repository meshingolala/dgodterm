import { SSHManager } from '../ssh/ssh-client';
import { AuditService } from '../audit/audit-service';

export interface ProcessItem {
  pid: number;
  ppid: number;
  user: string;
  cpu: number;
  mem: number;
  stat: string;
  time: string;
  command: string;
}

export const processHandlers = {
  'process:list': async (payload: {
    target: { sessionId?: string; profileId?: string };
    sortBy?: 'cpu' | 'mem';
    limit?: number;
  }): Promise<ProcessItem[]> => {
    const { target, sortBy = 'cpu', limit = 100 } = payload;
    const ssh = SSHManager.getInstance();
    const sortFlag = sortBy === 'mem' ? '--sort=-%mem' : '--sort=-%cpu';
    const numLimit = Math.min(Math.max(10, limit), 500);

    const cmd = `ps -eo pid,ppid,user,%cpu,%mem,stat,time,args ${sortFlag} 2>/dev/null | head -n ${numLimit + 1}`;
    const { stdout } = await ssh.executeCommandOnTarget(target, cmd);

    const lines = stdout.split('\n');
    const items: ProcessItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const tokens = line.split(/\s+/);
      if (tokens.length >= 8) {
        items.push({
          pid: parseInt(tokens[0], 10) || 0,
          ppid: parseInt(tokens[1], 10) || 0,
          user: tokens[2] || 'unknown',
          cpu: parseFloat(tokens[3]) || 0,
          mem: parseFloat(tokens[4]) || 0,
          stat: tokens[5] || '',
          time: tokens[6] || '',
          command: tokens.slice(7).join(' ')
        });
      }
    }

    return items;
  },

  'process:signal': async (payload: {
    target: { sessionId?: string; profileId?: string };
    pid: number;
    signal: 'TERM' | 'KILL' | 'HUP' | 'STOP' | 'CONT';
  }): Promise<{ success: boolean; output: string }> => {
    const { target, pid, signal } = payload;
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new Error('Invalid process ID');
    }

    const validSignals = ['TERM', 'KILL', 'HUP', 'STOP', 'CONT'];
    if (!validSignals.includes(signal)) {
      throw new Error('Unsupported signal');
    }

    const ssh = SSHManager.getInstance();
    const cmd = `kill -s ${signal} ${pid} 2>&1 || sudo -n kill -s ${signal} ${pid} 2>&1`;
    const { stdout, stderr, code } = await ssh.executeCommandOnTarget(target, cmd);
    const output = (stdout + '\n' + stderr).trim();
    const success = code === 0;

    AuditService.getInstance().logEvent({
      eventType: 'service_action',
      action: `process_signal_${signal.toLowerCase()}`,
      outcome: success ? 'success' : 'failed',
      resourceType: 'linux_process',
      resourceId: String(pid),
      metadata: { pid, signal, output, code }
    });

    return { success, output: output || `Signal ${signal} sent to PID ${pid}` };
  }
};
