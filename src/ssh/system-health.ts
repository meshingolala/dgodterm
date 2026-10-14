import { SSHManager } from './ssh-client';
import { SystemHealthMetrics } from '../domain/types';

export class SystemHealthMonitor {
  private static instance: SystemHealthMonitor;

  private constructor() {}

  public static getInstance(): SystemHealthMonitor {
    if (!SystemHealthMonitor.instance) {
      SystemHealthMonitor.instance = new SystemHealthMonitor();
    }
    return SystemHealthMonitor.instance;
  }

  private cache: Map<string, { metrics: SystemHealthMetrics; timestamp: number }> = new Map();

  /**
   * Samples Linux system telemetry using lightweight standard non-interactive commands.
   * Runs in one combined command batch to minimize SSH round-trips.
   * Supports either active sessionId or profileId (falling back to direct connection/open sessions).
   */
  public async getHealthMetrics(target: string | { sessionId?: string; profileId?: string }): Promise<SystemHealthMetrics> {
    const ssh = SSHManager.getInstance();
    const targetObj: { sessionId?: string; profileId?: string } =
      typeof target === 'string'
        ? (ssh.hasSession(target) ? { sessionId: target } : { profileId: target })
        : target;

    // Standard shell batch reading /proc and core POSIX stats:
    // 1. uptime & load: cat /proc/loadavg && uptime
    // 2. memory: cat /proc/meminfo
    // 3. disk: df -k /
    // 4. top processes: ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 6
    const script = `
echo "===LOADAVG==="
cat /proc/loadavg 2>/dev/null || uptime
echo "===MEMINFO==="
cat /proc/meminfo 2>/dev/null || free -m
echo "===DF==="
df -k / 2>/dev/null
echo "===PS==="
ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu 2>/dev/null | head -n 6
echo "===UPTIME==="
cat /proc/uptime 2>/dev/null || uptime
`;

    const { stdout } = await ssh.executeCommandOnTarget(targetObj, script);
    const metrics = this.parseMetrics(stdout);

    const cacheKey = targetObj.profileId || targetObj.sessionId;
    if (cacheKey) {
      this.cache.set(cacheKey, { metrics, timestamp: Date.now() });
    }

    return metrics;
  }

  public getCachedHealthMetrics(key: string): SystemHealthMetrics | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < 120000) {
      return entry.metrics;
    }
    return null;
  }

  private parseMetrics(raw: string): SystemHealthMetrics {
    const sections: Record<string, string> = {};
    let currentSection = '';

    for (const line of raw.split('\n')) {
      if (line.startsWith('===') && line.endsWith('===')) {
        currentSection = line.replace(/=/g, '').trim();
        sections[currentSection] = '';
      } else if (currentSection) {
        sections[currentSection] += line + '\n';
      }
    }

    // 1. Load Average & CPU
    let loadAverage: [number, number, number] = [0, 0, 0];
    const loadStr = sections['LOADAVG'] || '';
    const loadParts = loadStr.trim().split(/\s+/);
    if (loadParts.length >= 3 && !isNaN(parseFloat(loadParts[0]))) {
      loadAverage = [
        parseFloat(loadParts[0]) || 0,
        parseFloat(loadParts[1]) || 0,
        parseFloat(loadParts[2]) || 0
      ];
    }

    // 2. Memory
    let totalMem = 0;
    let freeMem = 0;
    let availableMem = 0;
    const memStr = sections['MEMINFO'] || '';
    for (const mLine of memStr.split('\n')) {
      if (mLine.startsWith('MemTotal:')) {
        const val = parseInt(mLine.replace(/[^0-9]/g, ''), 10);
        totalMem = val * 1024; // KB to Bytes
      } else if (mLine.startsWith('MemFree:')) {
        const val = parseInt(mLine.replace(/[^0-9]/g, ''), 10);
        freeMem = val * 1024;
      } else if (mLine.startsWith('MemAvailable:')) {
        const val = parseInt(mLine.replace(/[^0-9]/g, ''), 10);
        availableMem = val * 1024;
      }
    }
    const effectiveFree = availableMem > 0 ? availableMem : freeMem;
    const usedMem = Math.max(0, totalMem - effectiveFree);
    const memUsagePercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

    // 3. Disk
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    let diskPercent = 0;
    let mountPoint = '/';
    const dfStr = sections['DF'] || '';
    const dfLines = dfStr.trim().split('\n');
    if (dfLines.length > 1) {
      const parts = dfLines[1].trim().split(/\s+/);
      if (parts.length >= 6) {
        diskTotal = (parseInt(parts[1], 10) || 0) * 1024;
        diskUsed = (parseInt(parts[2], 10) || 0) * 1024;
        diskFree = (parseInt(parts[3], 10) || 0) * 1024;
        diskPercent = parseInt(parts[4]?.replace('%', ''), 10) || 0;
        mountPoint = parts[5] || '/';
      }
    }

    // 4. Processes
    const topProcesses: Array<{
      pid: number;
      user: string;
      cpuPercent: number;
      memPercent: number;
      command: string;
    }> = [];
    const psStr = sections['PS'] || '';
    const psLines = psStr.trim().split('\n');
    for (let i = 1; i < psLines.length; i++) {
      const line = psLines[i].trim();
      if (!line) continue;
      const tokens = line.split(/\s+/);
      if (tokens.length >= 5) {
        topProcesses.push({
          pid: parseInt(tokens[0], 10) || 0,
          user: tokens[1] || 'root',
          cpuPercent: parseFloat(tokens[2]) || 0,
          memPercent: parseFloat(tokens[3]) || 0,
          command: tokens.slice(4).join(' ') || 'unknown'
        });
      }
    }

    // Approximate CPU usage percent from load average & top processes
    const sumCpu = topProcesses.reduce((acc, p) => acc + p.cpuPercent, 0);
    const cpuUsagePercent = Math.min(100, Math.round(sumCpu > 0 ? sumCpu : loadAverage[0] * 10));

    // 5. Uptime string
    let uptimeStr = 'up';
    const uptimeData = sections['UPTIME'] || '';
    const upParts = uptimeData.trim().split(/\s+/);
    if (upParts.length > 0 && !isNaN(parseFloat(upParts[0]))) {
      const totalSec = Math.floor(parseFloat(upParts[0]));
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      uptimeStr = `${days > 0 ? `${days}d ` : ''}${hours}h ${mins}m`;
    }

    return {
      timestamp: Date.now(),
      uptime: uptimeStr,
      loadAverage,
      cpuUsagePercent,
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: effectiveFree,
        usagePercent: memUsagePercent
      },
      disk: {
        totalBytes: diskTotal,
        usedBytes: diskUsed,
        freeBytes: diskFree,
        usagePercent: diskPercent,
        mountPoint
      },
      topProcesses
    };
  }
}
