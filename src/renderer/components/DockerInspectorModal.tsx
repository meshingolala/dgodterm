import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  RefreshCw,
  X,
  Play,
  Square,
  RotateCw,
  Trash2,
  FileText,
  Terminal,
  Activity,
  AlertCircle,
  Copy,
  Check,
  Code2
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard-utils';

export interface ContainerItem {
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

interface DockerInspectorModalProps {
  target: { sessionId?: string; profileId?: string; label?: string };
  onClose: () => void;
  onOpenShell?: (command: string) => void;
}

export const DockerInspectorModal: React.FC<DockerInspectorModalProps> = ({
  target,
  onClose,
  onOpenShell
}) => {
  const [engine, setEngine] = useState<string>('docker');
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'running' | 'exited'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Selected container detail panes
  const [selectedContainer, setSelectedContainer] = useState<ContainerItem | null>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'inspect'>('logs');
  const [logsText, setLogsText] = useState('');
  const [inspectData, setInspectData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [logLines, setLogLines] = useState(100);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const targetId = `${target.sessionId || ''}:${target.profileId || ''}`;

  useEffect(() => {
    loadContainers();
  }, [targetId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadContainers(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, targetId]);

  const loadContainers = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await (window as any).dgodterm?.invokeFeature('docker:list', { target });
      if (res?.error) {
        setError(res.error);
      } else {
        setEngine(res?.engine || 'docker');
        setContainers(res?.containers || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to list containers');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleAction = async (containerId: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    if (action === 'remove' && !confirm('Are you sure you want to forcibly remove this container?')) return;
    setActionLoading(`${containerId}-${action}`);
    try {
      await (window as any).dgodterm?.invokeFeature('docker:action', {
        target,
        containerId,
        action
      });
      await loadContainers(true);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectContainer = async (c: ContainerItem) => {
    setSelectedContainer(c);
    loadContainerDetails(c, activeTab);
  };

  const loadContainerDetails = async (c: ContainerItem, tab: 'logs' | 'inspect') => {
    setLoadingDetails(true);
    try {
      if (tab === 'logs') {
        const logs = await (window as any).dgodterm?.invokeFeature('docker:logs', {
          target,
          containerId: c.id,
          lines: logLines
        });
        setLogsText(logs || 'No logs returned');
      } else {
        const data = await (window as any).dgodterm?.invokeFeature('docker:inspect', {
          target,
          containerId: c.id
        });
        setInspectData(data);
      }
    } catch (err: any) {
      if (tab === 'logs') setLogsText(`Error: ${err.message}`);
      else setInspectData({ error: err.message });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExecShell = (c: ContainerItem) => {
    const cmd = `${engine} exec -it ${c.name || c.id} sh -c "command -v bash >/dev/null && exec bash || exec sh"`;
    if (onOpenShell) {
      onOpenShell(cmd);
      onClose();
    }
  };

  const filtered = containers.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    const matchesState =
      filterState === 'all' ||
      (filterState === 'running' && c.state.toLowerCase() === 'running') ||
      (filterState === 'exited' && c.state.toLowerCase() !== 'running');
    return matchesSearch && matchesState;
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-5xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/80 text-sky-400">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Container Inspector & Management
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                  {engine}
                </span>
                <span className="text-[11px] font-normal text-slate-400">
                  {target.label || 'Target Host'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Inspect running containers, telemetry stats, live logs, and one-click shell exec
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
              title="Toggle 5s live polling"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{autoRefresh ? 'Live Polling: 5s' : 'Polling: Paused'}</span>
            </button>

            <button
              onClick={() => loadContainers()}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="Refresh container list"
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
              placeholder="Search by container name, image, or ID..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 text-xs focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            {(['all', 'running', 'exited'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterState(st)}
                className={`px-2.5 py-1 rounded capitalize transition cursor-pointer ${
                  filterState === st
                    ? 'bg-sky-600 text-slate-950 font-semibold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-5 py-2.5 bg-amber-950/40 border-b border-amber-900/60 text-amber-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Body Split */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Container List Table */}
          <div className="flex-1 overflow-y-auto border-r border-slate-800">
            {loading && containers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Discovering containers...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No containers matching filter.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                  <tr>
                    <th className="py-2 px-3 font-medium">Name / ID</th>
                    <th className="py-2 px-3 font-medium">Image</th>
                    <th className="py-2 px-3 font-medium">State</th>
                    <th className="py-2 px-3 font-medium">CPU / RAM</th>
                    <th className="py-2 px-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filtered.map((c) => {
                    const isSelected = selectedContainer?.id === c.id;
                    const isRunning = c.state.toLowerCase() === 'running';

                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleSelectContainer(c)}
                        className={`transition cursor-pointer hover:bg-slate-800/50 ${
                          isSelected ? 'bg-sky-950/30 border-l-2 border-l-sky-500' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-200 truncate max-w-[150px]">{c.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 truncate">{c.id.slice(0, 12)}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-300 truncate max-w-[150px]" title={c.image}>
                            {c.image}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{c.ports || 'no ports'}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isRunning
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            {c.status || c.state}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                          {c.cpuPercent ? (
                            <div>
                              <span className="text-cyan-400">{c.cpuPercent}</span>
                              <span className="text-slate-500 mx-1">|</span>
                              <span className="text-slate-300">{c.memUsage || c.memPercent}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {isRunning ? (
                              <>
                                <button
                                  onClick={() => handleAction(c.id, 'restart')}
                                  disabled={actionLoading === `${c.id}-restart`}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                  title="Restart Container"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleAction(c.id, 'stop')}
                                  disabled={actionLoading === `${c.id}-stop`}
                                  className="p-1 rounded bg-slate-800 hover:bg-amber-950/50 text-slate-300 hover:text-amber-400 transition"
                                  title="Stop Container"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleAction(c.id, 'start')}
                                disabled={actionLoading === `${c.id}-start`}
                                className="p-1 rounded bg-slate-800 hover:bg-emerald-950/50 text-slate-300 hover:text-emerald-400 transition"
                                title="Start Container"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onOpenShell && isRunning && (
                              <button
                                onClick={() => handleExecShell(c)}
                                className="p-1 rounded bg-slate-800 hover:bg-sky-950/50 text-sky-400 transition"
                                title="Exec Shell in Terminal"
                              >
                                <Terminal className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleAction(c.id, 'remove')}
                              disabled={actionLoading === `${c.id}-remove`}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition"
                              title="Remove Container"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Details Pane (Logs / Inspect) */}
          <div className="w-1/2 flex flex-col bg-slate-950/60 overflow-hidden">
            {selectedContainer ? (
              <div className="flex flex-col h-full">
                {/* Details Header */}
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{selectedContainer.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">({selectedContainer.id.slice(0, 12)})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex rounded bg-slate-800 p-0.5 text-[11px]">
                      <button
                        onClick={() => {
                          setActiveTab('logs');
                          loadContainerDetails(selectedContainer, 'logs');
                        }}
                        className={`px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                          activeTab === 'logs' ? 'bg-sky-600 text-slate-950 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        <FileText className="w-3 h-3" />
                        <span>Logs</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('inspect');
                          loadContainerDetails(selectedContainer, 'inspect');
                        }}
                        className={`px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                          activeTab === 'inspect' ? 'bg-sky-600 text-slate-950 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        <Code2 className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        const txt = activeTab === 'logs' ? logsText : JSON.stringify(inspectData, null, 2);
                        await copyTextToClipboard(txt);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                      title="Copy content"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Details Content */}
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-slate-300 bg-slate-950 whitespace-pre-wrap break-all">
                  {loadingDetails ? (
                    <div className="text-slate-500">Loading details...</div>
                  ) : activeTab === 'logs' ? (
                    logsText || 'No logs found'
                  ) : (
                    JSON.stringify(inspectData, null, 2) || 'No inspect output'
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
                <Boxes className="w-8 h-8 opacity-40 mb-2" />
                <p>Select a container from the table to inspect live logs and configuration.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
