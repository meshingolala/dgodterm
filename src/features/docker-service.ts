import { SSHManager } from '../ssh/ssh-client';
import { AuditService } from '../audit/audit-service';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  ports: string;
  cpuPercent?: string;
  memUsage?: string;
  memPercent?: string;
}

export interface DockerListResult {
  engine: 'docker' | 'podman' | 'none';
  containers: ContainerInfo[];
  error?: string;
}

async function detectEngine(target: { sessionId?: string; profileId?: string }): Promise<'docker' | 'podman' | 'none'> {
  const ssh = SSHManager.getInstance();
  try {
    const { code: dCode } = await ssh.executeCommandOnTarget(target, 'docker version 2>/dev/null || sudo -n docker version 2>/dev/null');
    if (dCode === 0) return 'docker';
    const { code: pCode } = await ssh.executeCommandOnTarget(target, 'podman version 2>/dev/null || sudo -n podman version 2>/dev/null');
    if (pCode === 0) return 'podman';
  } catch {}
  return 'none';
}

export const dockerHandlers = {
  'docker:list': async (payload: { target: { sessionId?: string; profileId?: string } }): Promise<DockerListResult> => {
    const { target } = payload;
    const ssh = SSHManager.getInstance();
    const engine = await detectEngine(target);

    if (engine === 'none') {
      return { engine: 'none', containers: [], error: 'Neither Docker nor Podman was detected or user lacks socket permissions.' };
    }

    const cmd = `${engine} ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}","created":"{{.CreatedAt}}","ports":"{{.Ports}}"}' 2>/dev/null || sudo -n ${engine} ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}","created":"{{.CreatedAt}}","ports":"{{.Ports}}"}' 2>/dev/null`;
    const { stdout } = await ssh.executeCommandOnTarget(target, cmd);

    const containers: ContainerInfo[] = [];
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        containers.push({
          id: parsed.id || '',
          name: parsed.name || '',
          image: parsed.image || '',
          status: parsed.status || '',
          state: parsed.state || '',
          created: parsed.created || '',
          ports: parsed.ports || ''
        });
      } catch {}
    }

    // Try fetching stats for running containers
    try {
      const statsCmd = `${engine} stats --no-stream --format '{"id":"{{.ID}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","memPerc":"{{.MemPerc}}"}' 2>/dev/null || sudo -n ${engine} stats --no-stream --format '{"id":"{{.ID}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","memPerc":"{{.MemPerc}}"}' 2>/dev/null`;
      const statsRes = await ssh.executeCommandOnTarget(target, statsCmd);
      const statsMap: Record<string, { cpu: string; mem: string; memPerc: string }> = {};

      for (const line of statsRes.stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const s = JSON.parse(trimmed);
          if (s.id) {
            statsMap[s.id] = { cpu: s.cpu || '0%', mem: s.mem || '0B', memPerc: s.memPerc || '0%' };
          }
        } catch {}
      }

      for (const c of containers) {
        // match by prefix id
        const key = Object.keys(statsMap).find((k) => c.id.startsWith(k) || k.startsWith(c.id));
        if (key && statsMap[key]) {
          c.cpuPercent = statsMap[key].cpu;
          c.memUsage = statsMap[key].mem;
          c.memPercent = statsMap[key].memPerc;
        }
      }
    } catch {}

    return { engine, containers };
  },

  'docker:action': async (payload: {
    target: { sessionId?: string; profileId?: string };
    containerId: string;
    action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove';
  }): Promise<{ success: boolean; output: string }> => {
    const { target, containerId, action } = payload;
    const cleanId = containerId.replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!cleanId) throw new Error('Invalid container identifier');

    const ssh = SSHManager.getInstance();
    const engine = await detectEngine(target);
    const useEngine = engine === 'none' ? 'docker' : engine;

    const op = action === 'remove' ? 'rm -f' : action;
    const cmd = `${useEngine} ${op} ${cleanId} 2>&1 || sudo -n ${useEngine} ${op} ${cleanId} 2>&1`;
    const { stdout, stderr, code } = await ssh.executeCommandOnTarget(target, cmd);
    const output = (stdout + '\n' + stderr).trim();
    const success = code === 0;

    AuditService.getInstance().logEvent({
      eventType: 'service_action',
      action: `docker_${action}_container`,
      outcome: success ? 'success' : 'failed',
      resourceType: 'docker_container',
      resourceId: cleanId,
      metadata: { action, engine: useEngine, output, code }
    });

    return { success, output };
  },

  'docker:logs': async (payload: {
    target: { sessionId?: string; profileId?: string };
    containerId: string;
    lines?: number;
  }): Promise<string> => {
    const { target, containerId, lines = 100 } = payload;
    const cleanId = containerId.replace(/[^a-zA-Z0-9_.-]/g, '');
    const num = Math.min(Math.max(10, lines), 1000);
    const ssh = SSHManager.getInstance();
    const engine = await detectEngine(target);
    const useEngine = engine === 'none' ? 'docker' : engine;

    const cmd = `${useEngine} logs --tail ${num} --timestamps ${cleanId} 2>&1 || sudo -n ${useEngine} logs --tail ${num} --timestamps ${cleanId} 2>&1`;
    const { stdout, stderr } = await ssh.executeCommandOnTarget(target, cmd);
    return (stdout || stderr || 'No logs found').trim();
  },

  'docker:inspect': async (payload: {
    target: { sessionId?: string; profileId?: string };
    containerId: string;
  }): Promise<any> => {
    const { target, containerId } = payload;
    const cleanId = containerId.replace(/[^a-zA-Z0-9_.-]/g, '');
    const ssh = SSHManager.getInstance();
    const engine = await detectEngine(target);
    const useEngine = engine === 'none' ? 'docker' : engine;

    const cmd = `${useEngine} inspect ${cleanId} 2>/dev/null || sudo -n ${useEngine} inspect ${cleanId} 2>/dev/null`;
    const { stdout } = await ssh.executeCommandOnTarget(target, cmd);
    try {
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return { raw: stdout || 'Inspect returned no data' };
    }
  }
};
