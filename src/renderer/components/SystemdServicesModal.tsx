import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  X,
  Play,
  Square,
  RotateCw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface SystemdUnitInfo {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

interface SystemdServicesModalProps {
  target: { sessionId?: string; profileId?: string; label: string };
  onClose: () => void;
}

export const SystemdServicesModal: React.FC<SystemdServicesModalProps> = ({ target, onClose }) => {
  const [services, setServices] = useState<SystemdUnitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'failed' | 'inactive'>('all');

  // Selected unit for Journalctl logs
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [journalLogs, setJournalLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logLines, setLogLines] = useState(100);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const targetId = `${target.sessionId || ''}:${target.profileId || ''}`;

  useEffect(() => {
    loadServices();
  }, [targetId]);

  const loadServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await (window as any).dgodterm.listSystemdServices(target);
      setServices(list || []);
    } catch (err: any) {
      setError(err.message || 'Failed to list systemd services');
    } finally {
      setLoading(false);
    }
  };

  const handleControlService = async (unit: string, action: 'start' | 'stop' | 'restart' | 'reload') => {
    setActionInProgress(`${unit}:${action}`);
    try {
      const res = await (window as any).dgodterm.controlSystemdService(target, unit, action);
      if (res.success) {
        await loadServices();
        if (selectedUnit === unit) {
          await loadJournalLogs(unit);
        }
      } else {
        alert(`Service action failed:\n${res.output}`);
      }
    } catch (err: any) {
      alert(`Error executing ${action} on ${unit}: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const loadJournalLogs = async (unit: string) => {
    setSelectedUnit(unit);
    setLoadingLogs(true);
    try {
      const logs = await (window as any).dgodterm.getSystemdJournal(target, unit, logLines);
      setJournalLogs(logs);
    } catch (err: any) {
      setJournalLogs(`[Error fetching logs: ${err.message}]`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCopyLogs = () => {
    if (!journalLogs) return;
    copyTextToClipboard(journalLogs);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'running') return s.active === 'active' && s.sub === 'running';
    if (statusFilter === 'failed') return s.active === 'failed';
    if (statusFilter === 'inactive') return s.active === 'inactive';
    return true;
  });

  const failedCount = services.filter((s) => s.active === 'failed').length;
  const runningCount = services.filter((s) => s.active === 'active' && s.sub === 'running').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Linux Systemd Services & Units
                </h2>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono">
                  {target.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect service state, failed units, control daemon lifecycle, and stream journalctl logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadServices}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by unit name or description (e.g. nginx, sshd, docker)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All ({services.length})
            </button>
            <button
              onClick={() => setStatusFilter('running')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'running'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Running ({runningCount})
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Failed ({failedCount})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Content Body: Service Table & Journal Logs Split */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          {/* Services Table List */}
          <div className={`${selectedUnit ? 'md:w-1/2' : 'w-full'} flex-1 overflow-y-auto border-r border-slate-800/80`}>
            {loading && services.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
                <p className="text-xs">Querying systemctl units across host...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-400 text-xs">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                {error}
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No systemd services match the current filter.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/80 text-slate-400 sticky top-0 border-b border-slate-800 z-10 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Service Unit</th>
                    <th className="py-2.5 px-3">State</th>
                    <th className="py-2.5 px-3">Sub-State</th>
                    <th className="py-2.5 px-3 text-right">Lifecycle Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredServices.map((s) => {
                    const isSelected = selectedUnit === s.unit;
                    const isRunning = s.active === 'active' && s.sub === 'running';
                    const isFailed = s.active === 'failed';

                    return (
                      <tr
                        key={s.unit}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-purple-950/20 border-l-2 border-purple-500' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-200 font-mono text-[11px]">
                            {s.unit}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {s.description}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isFailed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              <AlertTriangle className="w-3 h-3" /> failed
                            </span>
                          ) : isRunning ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-800">
                              {s.active}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {s.sub}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* Restart */}
                            <button
                              title="Restart Service"
                              disabled={actionInProgress !== null}
                              onClick={() => handleControlService(s.unit, 'restart')}
                              className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${actionInProgress === `${s.unit}:restart` ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Start or Stop */}
                            {isRunning ? (
                              <button
                                title="Stop Service"
                                disabled={actionInProgress !== null}
                                onClick={() => handleControlService(s.unit, 'stop')}
                                className="p-1 rounded hover:bg-red-950/40 text-red-400 hover:text-red-300 transition cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                              </button>
                            ) : (
                              <button
                                title="Start Service"
                                disabled={actionInProgress !== null}
                                onClick={() => handleControlService(s.unit, 'start')}
                                className="p-1 rounded hover:bg-emerald-950/40 text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}

                            {/* View Journalctl Logs */}
                            <button
                              title="Inspect journalctl Logs"
                              onClick={() => loadJournalLogs(s.unit)}
                              className={`p-1 rounded transition cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-600 text-white'
                                  : 'hover:bg-slate-700 text-purple-400 hover:text-purple-300'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
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

          {/* Integrated Journalctl Log Drawer */}
          {selectedUnit && (
            <div className="md:w-1/2 flex flex-col bg-slate-950 h-full border-t md:border-t-0 border-slate-800">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-mono font-bold text-slate-200">
                    journalctl -u {selectedUnit} -n {logLines}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={logLines}
                    onChange={(e) => {
                      const lines = Number(e.target.value);
                      setLogLines(lines);
                      if (selectedUnit) loadJournalLogs(selectedUnit);
                    }}
                    className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 text-[11px] focus:outline-none"
                  >
                    <option value={50}>50 lines</option>
                    <option value={100}>100 lines</option>
                    <option value={200}>200 lines</option>
                    <option value={500}>500 lines</option>
                  </select>

                  <button
                    onClick={() => loadJournalLogs(selectedUnit)}
                    disabled={loadingLogs}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Refresh logs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={handleCopyLogs}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer"
                    title="Copy full logs"
                  >
                    {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedLogs ? 'Copied' : 'Copy'}
                  </button>

                  <button
                    onClick={() => setSelectedUnit(null)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-3 overflow-auto font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap select-text bg-[#090d16]">
                {loadingLogs ? (
                  <div className="flex items-center gap-2 text-slate-500 p-4">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                    Fetching journal logs...
                  </div>
                ) : (
                  journalLogs || 'No log messages recorded for this unit.'
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>Total Units: <strong className="text-white">{services.length}</strong></span>
            <span>Running: <strong className="text-emerald-400">{runningCount}</strong></span>
            {failedCount > 0 && (
              <span className="text-red-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {failedCount} Failed
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500">
            Lifecycle actions are verified and signed into the cryptographic audit log.
          </div>
        </div>
      </div>
    </div>
  );
};
