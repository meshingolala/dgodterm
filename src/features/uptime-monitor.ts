import net from 'net';
import { dbOperations } from '../storage/db';
import { AuditService } from '../audit/audit-service';

export interface HostUptimeSample {
  t: number;
  up: boolean;
  latencyMs: number;
}

export interface HostUptimeState {
  profileId: string;
  name: string;
  hostname: string;
  port: number;
  status: 'up' | 'down' | 'unknown';
  latencyMs: number;
  lastChecked: number;
  lastChange: number;
  banner?: string;
  uptimePct24h: number;
  history: HostUptimeSample[];
}

export interface UptimeEvent {
  t: number;
  profileId: string;
  name: string;
  from: 'up' | 'down' | 'unknown';
  to: 'up' | 'down';
}

export class UptimeMonitorService {
  private static instance: UptimeMonitorService;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalSec = 60;
  private states: Map<string, HostUptimeState> = new Map();
  private events: UptimeEvent[] = [];

  private constructor() {}

  public static getInstance(): UptimeMonitorService {
    if (!UptimeMonitorService.instance) {
      UptimeMonitorService.instance = new UptimeMonitorService();
    }
    return UptimeMonitorService.instance;
  }

  public start(intervalSec = 60) {
    this.intervalSec = Math.max(15, intervalSec);
    this.isRunning = true;
    if (this.timer) clearInterval(this.timer);
    this.checkAll();
    this.timer = setInterval(() => this.checkAll(), this.intervalSec * 1000);
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getStatus() {
    return {
      running: this.isRunning,
      intervalSec: this.intervalSec,
      hosts: Array.from(this.states.values())
    };
  }

  public getEvents(limit = 50) {
    return this.events.slice(-limit).reverse();
  }

  public async checkAll() {
    const profiles = dbOperations.getProfiles();
    await Promise.allSettled(profiles.map((p) => this.checkHost(p)));
  }

  public async checkHost(p: { id: string; display_name: string; hostname: string; port: number }) {
    const start = Date.now();
    let state = this.states.get(p.id);

    if (!state) {
      state = {
        profileId: p.id,
        name: p.display_name,
        hostname: p.hostname,
        port: p.port || 22,
        status: 'unknown',
        latencyMs: 0,
        lastChecked: 0,
        lastChange: Date.now(),
        uptimePct24h: 100,
        history: []
      };
      this.states.set(p.id, state);
    }

    state.name = p.display_name;
    state.hostname = p.hostname;
    state.port = p.port || 22;

    const probe = await this.tcpProbe(p.hostname, p.port || 22, 2500);
    const latency = probe.up ? Date.now() - start : 0;
    const oldStatus = state.status;
    const newStatus: 'up' | 'down' = probe.up ? 'up' : 'down';

    state.status = newStatus;
    state.latencyMs = latency;
    state.lastChecked = Date.now();
    if (probe.banner) state.banner = probe.banner;

    // Track status change
    if (oldStatus !== 'unknown' && oldStatus !== newStatus) {
      state.lastChange = Date.now();
      const ev: UptimeEvent = {
        t: Date.now(),
        profileId: p.id,
        name: p.display_name,
        from: oldStatus,
        to: newStatus
      };
      this.events.push(ev);
      if (this.events.length > 200) this.events.shift();

      AuditService.getInstance().logEvent({
        eventType: 'service_action',
        action: `host_uptime_${newStatus}`,
        outcome: newStatus === 'up' ? 'success' : 'failed',
        resourceType: 'ssh_host',
        resourceId: p.hostname,
        metadata: { profileId: p.id, latencyMs: latency, oldStatus }
      });

      try {
        const { Notification } = require('electron');
        if (Notification && Notification.isSupported()) {
          new Notification({
            title: newStatus === 'up' ? `Server Online: ${p.display_name}` : `Server Alert: ${p.display_name} Offline`,
            body: newStatus === 'up'
              ? `${p.display_name} (${p.hostname}:${p.port || 22}) is now online (${latency}ms).`
              : `Alert: Cannot reach ${p.display_name} (${p.hostname}:${p.port || 22}). Port unresponsive.`
          }).show();
        }
      } catch {}
    }

    // Record sample (keep last 60 samples)
    state.history.push({ t: Date.now(), up: probe.up, latencyMs: latency });
    if (state.history.length > 60) state.history.shift();

    // Calculate 24h percentage
    const upCount = state.history.filter((h) => h.up).length;
    state.uptimePct24h = state.history.length > 0 ? Math.round((upCount / state.history.length) * 100) : 100;
  }

  private tcpProbe(host: string, port: number, timeoutMs = 2500): Promise<{ up: boolean; banner?: string }> {
    return new Promise((resolve) => {
      let banner = '';
      let finished = false;
      const socket = new net.Socket();

      const done = (up: boolean, ban?: string) => {
        if (finished) return;
        finished = true;
        try {
          socket.destroy();
        } catch {}
        resolve({ up, banner: ban });
      };

      socket.setTimeout(timeoutMs);

      socket.on('data', (data) => {
        banner += data.toString('utf8');
        if (banner.length > 80) banner = banner.slice(0, 80);
      });

      socket.on('connect', () => {
        // Wait a small bit to grab banner if SSH responds
        setTimeout(() => {
          done(true, banner.trim() || undefined);
        }, 120);
      });

      socket.on('timeout', () => {
        done(false);
      });

      socket.on('error', () => {
        done(false);
      });

      try {
        socket.connect(port, host);
      } catch {
        done(false);
      }
    });
  }
}

export const uptimeHandlers = {
  'uptime:start': async (payload?: { intervalSec?: number }) => {
    UptimeMonitorService.getInstance().start(payload?.intervalSec);
    return UptimeMonitorService.getInstance().getStatus();
  },
  'uptime:stop': async () => {
    UptimeMonitorService.getInstance().stop();
    return UptimeMonitorService.getInstance().getStatus();
  },
  'uptime:status': async () => {
    return UptimeMonitorService.getInstance().getStatus();
  },
  'uptime:check-now': async () => {
    await UptimeMonitorService.getInstance().checkAll();
    return UptimeMonitorService.getInstance().getStatus();
  },
  'uptime:events': async (payload?: { limit?: number }) => {
    return UptimeMonitorService.getInstance().getEvents(payload?.limit);
  }
};
