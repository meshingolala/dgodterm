import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  X,
  Play,
  Square,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio
} from 'lucide-react';

export interface HostUptimeItem {
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
  history: Array<{ t: number; up: boolean; latencyMs: number }>;
}

interface UptimeMonitorPanelProps {
  onClose: () => void;
  onConnect?: (profileId: string) => void;
}

export const UptimeMonitorPanel: React.FC<UptimeMonitorPanelProps> = ({ onClose, onConnect }) => {
  const [hosts, setHosts] = useState<HostUptimeItem[]>([]);
  const [running, setRunning] = useState(false);
  const [intervalSec, setIntervalSec] = useState(60);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    loadStatus();
    loadEvents();
    const timer = setInterval(() => {
      loadStatus(true);
      loadEvents();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const loadStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await (window as any).dgodterm?.invokeFeature('uptime:status');
      setHosts(res?.hosts || []);
      setRunning(res?.running || false);
      if (res?.intervalSec) setIntervalSec(res.intervalSec);
    } catch {} finally {
      if (!silent) setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const evs = await (window as any).dgodterm?.invokeFeature('uptime:events', { limit: 20 });
      setEvents(evs || []);
    } catch {}
  };

  const handleToggleMonitoring = async () => {
    try {
      if (running) {
        await (window as any).dgodterm?.invokeFeature('uptime:stop');
      } else {
        await (window as any).dgodterm?.invokeFeature('uptime:start', { intervalSec });
      }
      await loadStatus(true);
    } catch (err: any) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  const handleCheckNow = async () => {
    setLoading(true);
    try {
      const res = await (window as any).dgodterm?.invokeFeature('uptime:check-now');
      setHosts(res?.hosts || []);
    } finally {
      setLoading(false);
    }
  };

  const filtered = hosts.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.hostname.toLowerCase().includes(search.toLowerCase())
  );

  const upCount = hosts.filter((h) => h.status === 'up').length;
  const downCount = hosts.filter((h) => h.status === 'down').length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-5xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Automated Fleet Uptime & Latency Monitor
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                    running ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {running ? 'Active Background Checks' : 'Monitoring Stopped'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Continuous TCP connect pings & SSH banner detection with latency sparklines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMonitoring}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                running
                  ? 'bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
              }`}
            >
              {running ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{running ? 'Stop Monitor' : 'Start Monitor'}</span>
            </button>

            <button
              onClick={handleCheckNow}
              disabled={loading}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              title="Probe all hosts now"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 grid grid-cols-4 gap-4 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Monitored Hosts:</span>
            <span className="font-bold text-slate-200">{hosts.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Healthy (UP):</span>
            <span className="font-bold text-emerald-400">{upCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Unreachable (DOWN):</span>
            <span className="font-bold text-rose-400">{downCount}</span>
          </div>
          <div className="flex items-center justify-end gap-2 text-[11px]">
            <span className="text-slate-500">Interval:</span>
            <select
              value={intervalSec}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setIntervalSec(val);
                if (running) (window as any).dgodterm?.invokeFeature('uptime:start', { intervalSec: val });
              }}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-[11px]"
            >
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
              <option value={300}>5m</option>
            </select>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <div className="relative max-w-sm flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search host by name or IP..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1 text-slate-200 text-xs focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Table & Event Split */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Host Table */}
          <div className="flex-1 overflow-y-auto border-r border-slate-800">
            {hosts.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No hosts monitored. Click "Start Monitor" or "Probe all" to check your saved profiles.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                  <tr>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Host Profile</th>
                    <th className="py-2 px-3 font-medium">Latency</th>
                    <th className="py-2 px-3 font-medium">Latency Trend</th>
                    <th className="py-2 px-3 font-medium">24h Uptime</th>
                    <th className="py-2 px-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filtered.map((h) => {
                    const isUp = h.status === 'up';
                    // Render simple SVG sparkline from history
                    const latencies = h.history.map((s) => s.latencyMs);
                    const maxLat = Math.max(...latencies, 100);
                    const points = latencies.map((l, i) => `${(i / Math.max(latencies.length - 1, 1)) * 60},${20 - (l / maxLat) * 16}`).join(' ');

                    return (
                      <tr key={h.profileId} className="hover:bg-slate-800/30 transition">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              isUp
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border-rose-800'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                            {h.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-200 truncate max-w-[160px]">{h.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 truncate">
                            {h.hostname}:{h.port}
                          </div>
                          {h.banner && (
                            <div className="text-[9px] font-mono text-slate-600 truncate max-w-[180px]">{h.banner}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-mono">
                          {isUp ? (
                            <span className={h.latencyMs < 50 ? 'text-emerald-400' : h.latencyMs < 150 ? 'text-amber-400' : 'text-rose-400'}>
                              {h.latencyMs} ms
                            </span>
                          ) : (
                            <span className="text-slate-600">Timeout</span>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {latencies.length > 1 ? (
                            <svg className="w-16 h-5 overflow-visible">
                              <polyline
                                fill="none"
                                stroke={isUp ? '#10b981' : '#f43f5e'}
                                strokeWidth="1.5"
                                points={points}
                              />
                            </svg>
                          ) : (
                            <span className="text-slate-600 text-[10px]">Sampling...</span>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap font-semibold">
                          <span className={h.uptimePct24h >= 99 ? 'text-emerald-400' : h.uptimePct24h >= 90 ? 'text-amber-400' : 'text-rose-400'}>
                            {h.uptimePct24h}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {onConnect && (
                            <button
                              onClick={() => {
                                onConnect(h.profileId);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-sky-600 hover:text-slate-950 text-sky-400 text-[11px] font-medium transition cursor-pointer inline-flex items-center gap-1"
                            >
                              <Terminal className="w-3 h-3" />
                              <span>Connect</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Events Pane */}
          <div className="w-72 bg-slate-950/60 p-3 overflow-y-auto space-y-2 shrink-0">
            <h3 className="font-semibold text-slate-300 text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Recent State Transitions</span>
            </h3>

            {events.length === 0 ? (
              <p className="text-slate-500 text-[11px]">No state change events recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {events.map((e, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 truncate max-w-[120px]">{e.name}</span>
                      <span
                        className={`text-[9px] px-1 rounded uppercase font-bold ${
                          e.to === 'up' ? 'text-emerald-400 bg-emerald-950/80' : 'text-rose-400 bg-rose-950/80'
                        }`}
                      >
                        {e.to}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">{new Date(e.t).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
