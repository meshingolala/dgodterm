import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Search,
  RefreshCw,
  X,
  AlertOctagon,
  Activity,
  AlertCircle,
  Skull
} from 'lucide-react';

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

interface ProcessManagerModalProps {
  target: { sessionId?: string; profileId?: string; label?: string };
  onClose: () => void;
}

export const ProcessManagerModal: React.FC<ProcessManagerModalProps> = ({ target, onClose }) => {
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem'>('cpu');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmKillPid, setConfirmKillPid] = useState<ProcessItem | null>(null);

  const targetId = `${target.sessionId || ''}:${target.profileId || ''}`;

  useEffect(() => {
    loadProcesses();
  }, [targetId, sortBy]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadProcesses(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, targetId, sortBy]);

  const loadProcesses = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const items = await (window as any).dgodterm?.invokeFeature('process:list', {
        target,
        sortBy,
        limit: 150
      });
      setProcesses(items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to list processes');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSendSignal = async (pid: number, signal: 'TERM' | 'KILL' | 'HUP') => {
    setActionLoading(pid);
    try {
      await (window as any).dgodterm?.invokeFeature('process:signal', {
        target,
        pid,
        signal
      });
      setConfirmKillPid(null);
      await loadProcesses(true);
    } catch (err: any) {
      alert(`Signal failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = processes.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.command.toLowerCase().includes(s) ||
      p.user.toLowerCase().includes(s) ||
      String(p.pid).includes(s)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-5xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Remote Process Manager & Top Monitor
                <span className="text-[11px] font-normal text-slate-400">
                  {target.label || 'Target Host'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Live per-host process monitor with sorted CPU/RAM utilization and signal termination
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{autoRefresh ? 'Live Polling: 3s' : 'Paused'}</span>
            </button>

            <button
              onClick={() => loadProcesses()}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search process name, PID, user..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 text-xs focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Sort By:</span>
            <div className="flex rounded bg-slate-800 p-0.5 text-[11px]">
              <button
                onClick={() => setSortBy('cpu')}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  sortBy === 'cpu' ? 'bg-cyan-600 text-slate-950 font-semibold' : 'text-slate-400'
                }`}
              >
                CPU %
              </button>
              <button
                onClick={() => setSortBy('mem')}
                className={`px-2.5 py-1 rounded transition cursor-pointer ${
                  sortBy === 'mem' ? 'bg-cyan-600 text-slate-950 font-semibold' : 'text-slate-400'
                }`}
              >
                Memory %
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-5 py-2.5 bg-amber-950/40 border-b border-amber-900/60 text-amber-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Process Table */}
        <div className="flex-1 overflow-y-auto">
          {loading && processes.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Querying process table...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No matching processes found.</div>
          ) : (
            <table className="w-full text-left border-collapse font-mono text-[11px]">
              <thead className="bg-slate-950/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10 font-sans text-[11px]">
                <tr>
                  <th className="py-2 px-3 font-medium">PID</th>
                  <th className="py-2 px-3 font-medium">User</th>
                  <th className="py-2 px-3 font-medium">CPU %</th>
                  <th className="py-2 px-3 font-medium">Mem %</th>
                  <th className="py-2 px-3 font-medium">Time</th>
                  <th className="py-2 px-3 font-medium">Command</th>
                  <th className="py-2 px-3 font-medium text-right font-sans">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filtered.map((p) => {
                  const isHighCpu = p.cpu > 25;
                  const isHighMem = p.mem > 20;

                  return (
                    <tr
                      key={p.pid}
                      className={`hover:bg-slate-800/40 transition ${
                        isHighCpu ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-cyan-400 font-semibold">{p.pid}</td>
                      <td className="py-2 px-3 text-slate-300 font-sans">{p.user}</td>
                      <td className="py-2 px-3">
                        <span className={isHighCpu ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                          {p.cpu.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={isHighMem ? 'text-purple-400 font-bold' : 'text-slate-300'}>
                          {p.mem.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{p.time}</td>
                      <td className="py-2 px-3 text-slate-200 truncate max-w-md font-mono" title={p.command}>
                        {p.command}
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSendSignal(p.pid, 'TERM')}
                            disabled={actionLoading === p.pid}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer"
                            title="SIGTERM (Graceful Shutdown)"
                          >
                            TERM
                          </button>
                          <button
                            onClick={() => setConfirmKillPid(p)}
                            disabled={actionLoading === p.pid}
                            className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-semibold transition cursor-pointer flex items-center gap-1"
                            title="SIGKILL (Immediate Force Kill)"
                          >
                            <Skull className="w-3 h-3" />
                            <span>KILL</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Confirmation Modal for Kill */}
        {confirmKillPid && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-60 p-4">
            <div className="bg-slate-900 border border-rose-700/80 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-rose-400 font-semibold text-sm">
                <AlertOctagon className="w-5 h-5 shrink-0" />
                <span>Confirm Force Kill (SIGKILL)</span>
              </div>
              <p className="text-slate-300 text-xs">
                Are you sure you want to forcibly terminate PID <span className="font-mono font-bold text-rose-400">{confirmKillPid.pid}</span>?
              </p>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-slate-300 truncate">
                {confirmKillPid.command}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setConfirmKillPid(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSendSignal(confirmKillPid.pid, 'KILL')}
                  className="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md"
                >
                  Confirm SIGKILL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
