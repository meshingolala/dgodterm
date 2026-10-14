import React, { useState, useEffect } from 'react';
import {
  PlaySquare,
  RefreshCw,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Server,
  Sliders,
  Terminal,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Zap,
  Layers
} from 'lucide-react';
import { ConnectionProfile } from '../../domain/types';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface RunbookParameter {
  name: string;
  label: string;
  defaultValue: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  description: string;
}

interface RunbookDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
  parameters: RunbookParameter[];
  scriptTemplate: string;
}

interface RunbookHostResult {
  hostIdentifier: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'aborted';
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  isCanary?: boolean;
}

interface RunbookExecutionReport {
  runId: string;
  runbookId: string;
  runbookTitle: string;
  strategy: 'canary' | 'sequential' | 'parallel';
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'canary_failed' | 'failed';
  hostResults: RunbookHostResult[];
}

interface RunbookRunnerModalProps {
  profiles: ConnectionProfile[];
  onClose: () => void;
}

export const RunbookRunnerModal: React.FC<RunbookRunnerModalProps> = ({ profiles, onClose }) => {
  const [runbooks, setRunbooks] = useState<RunbookDefinition[]>([]);
  const [selectedRunbookId, setSelectedRunbookId] = useState<string>('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<'canary' | 'sequential' | 'parallel'>('canary');

  const [executing, setExecuting] = useState(false);
  const [report, setReport] = useState<RunbookExecutionReport | null>(null);
  const [expandedHostIndex, setExpandedHostIndex] = useState<number | null>(null);
  const [copiedHostIndex, setCopiedHostIndex] = useState<number | null>(null);

  useEffect(() => {
    loadCatalog();
    if (profiles.length > 0) {
      setSelectedProfileIds(profiles.slice(0, 3).map((p) => p.id));
    }
  }, [profiles]);

  const loadCatalog = async () => {
    try {
      const list = await (window as any).dgodterm.getRunbookCatalog();
      if (list && list.length > 0) {
        setRunbooks(list);
        setSelectedRunbookId(list[0].id);
        const defaults: Record<string, string> = {};
        for (const p of list[0].parameters) {
          defaults[p.name] = p.defaultValue;
        }
        setParamValues(defaults);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectRunbook = (rb: RunbookDefinition) => {
    setSelectedRunbookId(rb.id);
    const defaults: Record<string, string> = {};
    for (const p of rb.parameters) {
      defaults[p.name] = p.defaultValue;
    }
    setParamValues(defaults);
  };

  const handleToggleProfile = (id: string) => {
    if (selectedProfileIds.includes(id)) {
      setSelectedProfileIds(selectedProfileIds.filter((pId) => pId !== id));
    } else {
      setSelectedProfileIds([...selectedProfileIds, id]);
    }
  };

  const handleExecute = async () => {
    if (selectedProfileIds.length === 0) {
      alert('Please select at least one target server.');
      return;
    }

    setExecuting(true);
    setReport(null);

    const targets = selectedProfileIds.map((id) => {
      const p = profiles.find((prof) => prof.id === id);
      return {
        profileId: id,
        label: p ? `${p.display_name} (${p.hostname})` : id
      };
    });

    try {
      const rep = await (window as any).dgodterm.executeRunbook(
        selectedRunbookId,
        paramValues,
        targets,
        strategy
      );
      setReport(rep);
      if (rep.hostResults.length > 0) {
        setExpandedHostIndex(0);
      }
    } catch (err: any) {
      alert(`Runbook execution failed: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyLogs = (idx: number, text: string) => {
    copyTextToClipboard(text);
    setCopiedHostIndex(idx);
    setTimeout(() => setCopiedHostIndex(null), 2000);
  };

  const activeRunbook = runbooks.find((r) => r.id === selectedRunbookId) || runbooks[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <PlaySquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Corporate Fleet Runbook Runner
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Execute parameterized enterprise maintenance workflows with rolling canary safeguards across your Linux fleet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split: Configuration vs Results */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          {/* Left Panel: Runbook Selection & Parameters */}
          <div className="md:w-5/12 border-r border-slate-800 flex flex-col bg-slate-950/40 overflow-y-auto p-5 space-y-4">
            {/* Catalog Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                1. Select Enterprise Runbook
              </label>
              <div className="space-y-1.5">
                {runbooks.map((rb) => {
                  const isSelected = selectedRunbookId === rb.id;
                  return (
                    <div
                      key={rb.id}
                      onClick={() => handleSelectRunbook(rb)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/40'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{rb.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {rb.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {rb.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parameter Inputs */}
            {activeRunbook && activeRunbook.parameters.length > 0 && (
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  2. Runbook Parameters
                </label>
                {activeRunbook.parameters.map((param) => (
                  <div key={param.name}>
                    <label className="text-xs text-slate-300 block mb-1">
                      {param.label}
                    </label>
                    {param.type === 'select' && param.options ? (
                      <select
                        value={paramValues[param.name] ?? param.defaultValue}
                        onChange={(e) =>
                          setParamValues({ ...paramValues, [param.name]: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                      >
                        {param.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={paramValues[param.name] ?? param.defaultValue}
                        onChange={(e) =>
                          setParamValues({ ...paramValues, [param.name]: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    )}
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {param.description}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Target Hosts Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  3. Target Linux Servers ({selectedProfileIds.length} selected)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedProfileIds(
                      selectedProfileIds.length === profiles.length
                        ? []
                        : profiles.map((p) => p.id)
                    )
                  }
                  className="text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  {selectedProfileIds.length === profiles.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-xl border border-slate-800 bg-slate-950/80">
                {profiles.map((p) => {
                  const isChecked = selectedProfileIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-800/60 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleProfile(p.id)}
                        className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span className="text-slate-200 font-medium">{p.display_name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({p.hostname})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Execution Strategy */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                4. Rollout Strategy
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStrategy('canary')}
                  className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer transition ${
                    strategy === 'canary'
                      ? 'border-emerald-500 bg-emerald-950/30 text-emerald-400'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Canary (1 &rarr; N)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('sequential')}
                  className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer transition ${
                    strategy === 'sequential'
                      ? 'border-sky-500 bg-sky-950/30 text-sky-400'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Sequential</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('parallel')}
                  className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer transition ${
                    strategy === 'parallel'
                      ? 'border-purple-500 bg-purple-950/30 text-purple-400'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>Parallel</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {strategy === 'canary'
                  ? 'Runs on the first host as a canary. If successful, automatically rolls out to remaining servers. Halts immediately if canary fails.'
                  : strategy === 'sequential'
                  ? 'Runs on one server at a time.'
                  : 'Runs on all selected servers simultaneously.'}
              </span>
            </div>

            {/* Execute Button */}
            <div className="pt-2">
              <button
                onClick={handleExecute}
                disabled={executing || selectedProfileIds.length === 0}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-4 h-4 fill-current ${executing ? 'animate-pulse' : ''}`} />
                {executing ? 'Executing Runbook on Fleet...' : `Execute Runbook (${selectedProfileIds.length} Servers)`}
              </button>
            </div>
          </div>

          {/* Right Panel: Live Execution Progress & Output */}
          <div className="md:w-7/12 flex flex-col bg-[#070b12] overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Execution Console & Output Logs</span>
              </div>
              {report && (
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    report.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : report.status === 'canary_failed'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  Status: {report.status}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {executing && !report ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
                  <p className="text-xs">Executing {activeRunbook.title} across fleet...</p>
                </div>
              ) : !report ? (
                <div className="p-16 text-center text-slate-500 text-xs">
                  Configure parameters, select target servers, and click Execute to start rollout.
                </div>
              ) : (
                report.hostResults.map((hr, idx) => {
                  const isExpanded = expandedHostIndex === idx;
                  const isSuccess = hr.status === 'success';
                  const isFailed = hr.status === 'failed';
                  const isAborted = hr.status === 'aborted';

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border overflow-hidden transition ${
                        isFailed
                          ? 'border-red-500/30 bg-red-950/10'
                          : isSuccess
                          ? 'border-emerald-500/30 bg-emerald-950/10'
                          : isAborted
                          ? 'border-amber-500/30 bg-amber-950/10'
                          : 'border-slate-800 bg-slate-900/40'
                      }`}
                    >
                      <div
                        onClick={() => setExpandedHostIndex(isExpanded ? null : idx)}
                        className="p-3 flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5">
                          {isSuccess ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : isFailed ? (
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                          )}
                          <span className="text-xs font-bold text-white font-mono">
                            {hr.hostIdentifier}
                          </span>
                          {hr.isCanary && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 font-semibold uppercase">
                              Canary
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400 text-[11px]">
                            {hr.durationMs}ms &bull; Exit Code: {hr.exitCode ?? '-'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isSuccess
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isFailed
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {hr.status}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-3 border-t border-slate-800 bg-slate-950 font-mono text-[11px] select-text">
                          <div className="flex justify-end mb-1">
                            <button
                              onClick={() => handleCopyLogs(idx, hr.stdout + '\n' + hr.stderr)}
                              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white cursor-pointer"
                            >
                              {copiedHostIndex === idx ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              {copiedHostIndex === idx ? 'Copied' : 'Copy Output'}
                            </button>
                          </div>
                          <div className="whitespace-pre-wrap text-slate-300 max-h-60 overflow-y-auto">
                            {hr.stdout}
                            {hr.stderr && (
                              <span className="text-red-400 block mt-1">{hr.stderr}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Fleet execution logs are recorded in the SHA-256 tamper-evident audit ledger.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
