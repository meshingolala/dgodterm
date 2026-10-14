import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Search,
  ArrowRight,
  Server,
  FileCode
} from 'lucide-react';
import { ConnectionProfile } from '../../domain/types';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface DiffLine {
  lineNumA?: number;
  lineNumB?: number;
  type: 'same' | 'added' | 'removed' | 'modified';
  contentA?: string;
  contentB?: string;
}

interface ConfigDriftResult {
  pathOrCommand: string;
  hostAIdentifier: string;
  hostBIdentifier: string;
  identical: boolean;
  mismatchedLineCount: number;
  totalLinesA: number;
  totalLinesB: number;
  contentA: string;
  contentB: string;
  diffLines: DiffLine[];
  timestamp: string;
}

interface ConfigDriftModalProps {
  profiles: ConnectionProfile[];
  initialHostAId?: string;
  initialHostBId?: string;
  onClose: () => void;
}

const COMMON_CONFIG_PRESETS = [
  { label: 'Nginx Config', path: '/etc/nginx/nginx.conf' },
  { label: 'SSH Server Config', path: '/etc/ssh/sshd_config' },
  { label: 'Kernel Sysctl', path: '/etc/sysctl.conf' },
  { label: 'Static Hosts', path: '/etc/hosts' },
  { label: 'DNS Resolvers', path: '/etc/resolv.conf' },
  { label: 'Filesystem Mounts', path: '/etc/fstab' },
  { label: 'Debian Packages (dpkg -l)', path: 'dpkg -l | grep -v "^+++" | head -n 80' },
  { label: 'RHEL Packages (rpm -qa)', path: 'rpm -qa | sort | head -n 80' },
];

export const ConfigDriftModal: React.FC<ConfigDriftModalProps> = ({
  profiles,
  initialHostAId,
  initialHostBId,
  onClose
}) => {
  const [hostAId, setHostAId] = useState<string>(initialHostAId || (profiles[0]?.id || ''));
  const [hostBId, setHostBId] = useState<string>(
    initialHostBId || (profiles[1]?.id || profiles[0]?.id || '')
  );
  const [pathOrCommand, setPathOrCommand] = useState<string>('/etc/ssh/sshd_config');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfigDriftResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [diffFilter, setDiffFilter] = useState<'all' | 'diffs_only'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const handleRunComparison = async () => {
    if (!hostAId || !hostBId) {
      setError('Please select both Host A and Host B to compare.');
      return;
    }
    if (!pathOrCommand.trim()) {
      setError('Please specify a file path or command to inspect.');
      return;
    }

    setLoading(true);
    setError(null);

    const profA = profiles.find((p) => p.id === hostAId);
    const profB = profiles.find((p) => p.id === hostBId);

    try {
      const res = await (window as any).dgodterm.compareConfigDrift(
        { profileId: hostAId, label: profA ? `${profA.display_name} (${profA.hostname})` : hostAId },
        { profileId: hostBId, label: profB ? `${profB.display_name} (${profB.hostname})` : hostBId },
        pathOrCommand.trim()
      );
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Configuration comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!result) return;
    const summary = `=== DGODTERM CONFIGURATION DRIFT REPORT ===\nDate: ${result.timestamp}\nPath/Command: ${result.pathOrCommand}\nHost A: ${result.hostAIdentifier}\nHost B: ${result.hostBIdentifier}\nStatus: ${result.identical ? 'IDENTICAL' : `DRIFT DETECTED (${result.mismatchedLineCount} mismatches)`}\n\n--- CONTENT A ---\n${result.contentA}\n\n--- CONTENT B ---\n${result.contentB}`;
    copyTextToClipboard(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibleDiffLines = (result?.diffLines || []).filter((line) => {
    if (diffFilter === 'diffs_only' && line.type === 'same') return false;
    if (searchFilter) {
      const query = searchFilter.toLowerCase();
      const inA = (line.contentA || '').toLowerCase().includes(query);
      const inB = (line.contentB || '').toLowerCase().includes(query);
      if (!inA && !inB) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Multi-Host Configuration Drift & Diff Viewer
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Detect divergence in configuration files, sysctl parameters, or installed package versions between servers
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

        {/* Configuration Bar */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/40 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Host A Select */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Reference Server (Host A)
              </label>
              <select
                value={hostAId}
                onChange={(e) => setHostAId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.username}@{p.hostname}:{p.port})
                  </option>
                ))}
              </select>
            </div>

            {/* Host B Select */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Target Server to Compare (Host B)
              </label>
              <select
                value={hostBId}
                onChange={(e) => setHostBId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.username}@{p.hostname}:{p.port})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Path & Preset Selection */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Configuration File Path or Command
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Presets:</span>
                {COMMON_CONFIG_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setPathOrCommand(preset.path)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. /etc/nginx/nginx.conf or /etc/ssh/sshd_config"
                value={pathOrCommand}
                onChange={(e) => setPathOrCommand(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={handleRunComparison}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Comparing...' : 'Compare Drift'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Drift Status Banner */}
        {result && (
          <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {result.identical ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>IDENTICAL: ZERO CONFIGURATION DRIFT</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4" />
                  <span>DRIFT DETECTED: {result.mismatchedLineCount} Mismatched Line(s)</span>
                </div>
              )}

              <span className="text-xs text-slate-400">
                Host A: <strong>{result.totalLinesA}</strong> lines &bull; Host B: <strong>{result.totalLinesB}</strong> lines
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter */}
              <button
                onClick={() => setDiffFilter(diffFilter === 'all' ? 'diffs_only' : 'all')}
                className={`px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                  diffFilter === 'diffs_only'
                    ? 'bg-amber-600 text-white font-medium'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {diffFilter === 'diffs_only' ? 'Showing Diffs Only' : 'Show Diffs Only'}
              </button>

              {/* Copy Report */}
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Report'}
              </button>
            </div>
          </div>
        )}

        {/* Side-by-Side Diff Table Area */}
        <div className="flex-1 overflow-auto bg-[#070b12] font-mono text-[11px]">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
              <p className="text-xs">Fetching file contents concurrently from Host A and Host B...</p>
            </div>
          ) : !result ? (
            <div className="p-16 text-center text-slate-500 text-xs">
              Select two hosts and click &ldquo;Compare Drift&rdquo; to visualize side-by-side differences.
            </div>
          ) : (
            <div className="min-w-full">
              {/* Header row for diff */}
              <div className="grid grid-cols-2 sticky top-0 bg-slate-950 border-b border-slate-800 font-sans font-semibold text-xs text-slate-400 z-10">
                <div className="p-2.5 px-4 border-r border-slate-800 flex items-center justify-between">
                  <span className="text-sky-400 font-bold">Host A: {result.hostAIdentifier}</span>
                </div>
                <div className="p-2.5 px-4 flex items-center justify-between">
                  <span className="text-purple-400 font-bold">Host B: {result.hostBIdentifier}</span>
                </div>
              </div>

              {/* Diff lines */}
              <div className="divide-y divide-slate-800/30">
                {visibleDiffLines.map((line, idx) => {
                  const isModified = line.type === 'modified';
                  const isRemoved = line.type === 'removed';
                  const isAdded = line.type === 'added';

                  const rowBg = isModified
                    ? 'bg-amber-950/20'
                    : isRemoved
                    ? 'bg-red-950/20'
                    : isAdded
                    ? 'bg-emerald-950/20'
                    : '';

                  return (
                    <div key={idx} className={`grid grid-cols-2 hover:bg-slate-800/30 ${rowBg}`}>
                      {/* Host A side */}
                      <div className="flex border-r border-slate-800/60 p-1 px-3 overflow-x-auto">
                        <span className="w-8 shrink-0 text-slate-600 select-none text-right pr-2">
                          {line.lineNumA ?? ''}
                        </span>
                        <span
                          className={`flex-1 whitespace-pre break-all ${
                            isModified || isRemoved ? 'text-red-300 font-medium' : 'text-slate-300'
                          }`}
                        >
                          {line.contentA ?? ''}
                        </span>
                      </div>

                      {/* Host B side */}
                      <div className="flex p-1 px-3 overflow-x-auto">
                        <span className="w-8 shrink-0 text-slate-600 select-none text-right pr-2">
                          {line.lineNumB ?? ''}
                        </span>
                        <span
                          className={`flex-1 whitespace-pre break-all ${
                            isModified || isAdded ? 'text-emerald-300 font-medium' : 'text-slate-300'
                          }`}
                        >
                          {line.contentB ?? ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Non-destructive read-only operation. Cryptographic event recorded in audit logs.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
