import React, { useState, useEffect } from 'react';
import {
  Radio,
  Search,
  RefreshCw,
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Activity
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface NetworkSocketInfo {
  protocol: string;
  localAddress: string;
  port: number;
  foreignAddress: string;
  state: string;
  pid?: string;
  processName?: string;
  isPubliclyExposed: boolean;
  isRisky: boolean;
  riskReason?: string;
}

interface NetworkPortsReport {
  sockets: NetworkSocketInfo[];
  firewallStatus: string;
  totalListening: number;
  riskyExposureCount: number;
  timestamp: string;
}

interface NetworkPortsModalProps {
  target: { sessionId?: string; profileId?: string; label: string };
  onClose: () => void;
}

export const NetworkPortsModal: React.FC<NetworkPortsModalProps> = ({ target, onClose }) => {
  const [report, setReport] = useState<NetworkPortsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRiskyOnly, setShowRiskyOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const targetId = `${target.sessionId || ''}:${target.profileId || ''}`;

  useEffect(() => {
    loadSockets();
  }, [targetId]);

  const loadSockets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await (window as any).dgodterm.getNetworkSockets(target);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect network sockets.');
    } finally {
      setLoading(false);
    }
  };

  const filteredSockets = (report?.sockets || []).filter((s) => {
    if (showRiskyOnly && !s.isRisky) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.port.toString().includes(q) ||
      s.protocol.toLowerCase().includes(q) ||
      s.localAddress.toLowerCase().includes(q) ||
      (s.processName || '').toLowerCase().includes(q) ||
      (s.pid || '').includes(q)
    );
  });

  const handleCopy = () => {
    if (!report) return;
    const text = report.sockets
      .map(
        (s) =>
          `${s.protocol.toUpperCase()}\t${s.localAddress}:${s.port}\t${s.state}\tPID:${s.pid || '-'}\t${s.processName || '-'}${s.isRisky ? `\t[RISK: ${s.riskReason}]` : ''}`
      )
      .join('\n');
    copyTextToClipboard(`=== LISTENING PORTS ON ${target.label} ===\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Listening Ports & Network Sockets
                </h2>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono">
                  {target.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time kernel network socket audit, bound interfaces, process PIDs, and attack surface detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSockets}
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

        {/* Status Strip & Search Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by port, process name, or PID (e.g. 80, 443, nginx)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {report?.firewallStatus && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400 text-[11px]">Firewall:</span>
                <span className="font-semibold text-white text-[11px]">{report.firewallStatus}</span>
              </div>
            )}

            <button
              onClick={() => setShowRiskyOnly(!showRiskyOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
                showRiskyOnly
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Risky Exposures ({report?.riskyExposureCount || 0})
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Export Table'}
            </button>
          </div>
        </div>

        {/* Sockets Table */}
        <div className="flex-1 overflow-auto bg-[#070b12]">
          {loading && !report ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-xs">Inspecting kernel sockets (ss -tulpn) on {target.label}...</p>
            </div>
          ) : error && !report ? (
            <div className="p-12 text-center text-red-400 text-xs">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
              {error}
            </div>
          ) : filteredSockets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No network sockets match the current criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800 z-10 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Port & Protocol</th>
                  <th className="py-2.5 px-4">Bound Address</th>
                  <th className="py-2.5 px-4">Foreign / Peer</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4">Process Name & PID</th>
                  <th className="py-2.5 px-4">Security Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                {filteredSockets.map((s, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      s.isRisky ? 'bg-amber-950/15' : ''
                    }`}
                  >
                    <td className="py-2 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{s.port}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 uppercase font-sans">
                          {s.protocol}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-4 whitespace-nowrap text-slate-300">
                      <span className={s.isPubliclyExposed ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                        {s.localAddress}
                      </span>
                    </td>

                    <td className="py-2 px-4 whitespace-nowrap text-slate-500">
                      {s.foreignAddress}
                    </td>

                    <td className="py-2 px-4 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {s.state}
                      </span>
                    </td>

                    <td className="py-2 px-4 whitespace-nowrap">
                      <div className="text-slate-200 font-semibold">{s.processName}</div>
                      {s.pid && <div className="text-[10px] text-slate-500">PID: {s.pid}</div>}
                    </td>

                    <td className="py-2 px-4">
                      {s.isRisky ? (
                        <div className="flex items-center gap-1.5 text-amber-400 font-sans text-xs">
                          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                          <span className="text-[11px] leading-tight">{s.riskReason}</span>
                        </div>
                      ) : s.isPubliclyExposed ? (
                        <div className="flex items-center gap-1.5 text-slate-400 font-sans text-[11px]">
                          <Activity className="w-3.5 h-3.5 text-sky-400" />
                          <span>Bound to all interfaces (0.0.0.0)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-sans text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Loopback / Local only</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Total Sockets: <strong className="text-white">{report?.totalListening || 0}</strong> &bull; Risky Exposures: <strong className="text-amber-400">{report?.riskyExposureCount || 0}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
