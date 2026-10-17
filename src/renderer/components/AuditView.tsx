import React, { useState, useEffect } from 'react';
import { AuditEvent } from '../../domain/types';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  X,
  FileCheck2,
  Lock
} from 'lucide-react';

export const AuditView: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'session' | 'sftp' | 'automation' | 'vault' | 'security'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'success' | 'failure' | 'denied'>('all');
  const [queryLimit, setQueryLimit] = useState<number>(200);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<{
    tested: boolean;
    valid?: boolean;
    total?: number;
    message?: string;
  }>({ tested: false });
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadEvents(queryLimit);
    handleVerifyIntegrity();
  }, [queryLimit]);

  const loadEvents = async (limitVal = queryLimit) => {
    try {
      const data = await (window as any).dgodterm.getAuditEvents(limitVal);
      setEvents(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const result = await (window as any).dgodterm.verifyAuditIntegrity();
      setIntegrityStatus({
        tested: true,
        valid: result.isValid,
        total: result.totalEvents,
        message: result.message
      });
    } catch (e: any) {
      setIntegrityStatus({
        tested: true,
        valid: false,
        message: e.message
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleExportBundle = async () => {
    try {
      const bundle = await (window as any).dgodterm.exportAuditBundle();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', `dgodterm-audit-evidence-${new Date().toISOString().slice(0, 10)}.json`);
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = events.filter((ev) => {
    const s = search.toLowerCase();
    const matchesSearch =
      !s ||
      ev.event_type.toLowerCase().includes(s) ||
      ev.action.toLowerCase().includes(s) ||
      ev.actor_id.toLowerCase().includes(s) ||
      (ev.resource_id && ev.resource_id.toLowerCase().includes(s)) ||
      (ev.change_reference && ev.change_reference.toLowerCase().includes(s));

    if (!matchesSearch) return false;

    if (outcomeFilter !== 'all' && ev.outcome !== outcomeFilter) return false;

    if (categoryFilter !== 'all') {
      const t = ev.event_type.toLowerCase();
      if (categoryFilter === 'session' && !t.startsWith('session_')) return false;
      if (categoryFilter === 'sftp' && !t.startsWith('sftp_')) return false;
      if (categoryFilter === 'automation' && !t.startsWith('automation_') && !t.startsWith('runbook_') && !t.startsWith('configuration_')) return false;
      if (categoryFilter === 'vault' && !t.startsWith('vault_') && !t.startsWith('mfa_')) return false;
      if (categoryFilter === 'security' && !t.startsWith('host_trust_') && !t.startsWith('breakglass_') && !t.startsWith('policy_')) return false;
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#090d16] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" />
            ISO/IEC 27001 Cryptographic Audit Trail
          </h2>
          <p className="text-xs text-slate-400">
            Append-only tamper-evident ledger with SHA-256 hash chaining (<span className="font-mono text-sky-400">integrity_link</span>)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadEvents(queryLimit)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Refresh Audit Log"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          <button
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition"
          >
            {verifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            Verify Trail Integrity
          </button>

          <button
            onClick={handleExportBundle}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <Download className="w-4 h-4" />
            Export Evidence Pack
          </button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {integrityStatus.tested && (
        <div
          className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
            integrityStatus.valid
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {integrityStatus.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span className="font-medium">{integrityStatus.message}</span>
          </div>
          <span className="font-mono text-[11px] opacity-80">
            {integrityStatus.valid ? 'All SHA-256 hash chain links strictly intact' : 'Hash link verification mismatch detected'}
          </span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 w-72">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search action, actor, resource, ticket..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
            {([
              { id: 'all', label: 'All' },
              { id: 'session', label: 'SSH' },
              { id: 'sftp', label: 'SFTP' },
              { id: 'automation', label: 'Ansible' },
              { id: 'vault', label: 'Vault' },
              { id: 'security', label: 'Security' }
            ] as const).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  categoryFilter === cat.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Outcome Filter */}
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
          >
            <option value="all">All Outcomes</option>
            <option value="success">Success Only</option>
            <option value="failure">Failures Only</option>
            <option value="denied">Policy Denied</option>
          </select>

          {/* Limit Selector */}
          <select
            value={queryLimit}
            onChange={(e) => setQueryLimit(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
          >
            <option value={200}>Latest 200</option>
            <option value={500}>Latest 500</option>
            <option value={-1}>All Events ({integrityStatus.total || events.length})</option>
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-semibold">{filtered.length}</span> of{' '}
          <span className="text-slate-300 font-semibold">{integrityStatus.total || events.length}</span> events
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                <th className="py-2.5 px-4 font-sans font-semibold">Timestamp (UTC)</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Event Type</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Actor</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Resource</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Outcome</th>
                <th className="py-2.5 px-4 font-sans font-semibold">Integrity Hash Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => (
                <tr
                  key={ev.event_id}
                  onClick={() => setSelectedEvent(ev)}
                  className="border-b border-slate-800/40 hover:bg-slate-800/40 cursor-pointer transition"
                >
                  <td className="py-2 px-4 text-slate-400 text-[11px]">
                    {new Date(ev.occurred_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-sky-400 font-semibold">{ev.event_type}</td>
                  <td className="py-2 px-3 text-slate-300">{ev.actor_id}</td>
                  <td className="py-2 px-3 text-slate-400 truncate max-w-[140px]">
                    {ev.resource_id || '-'}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                        ev.outcome === 'success'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : ev.outcome === 'denied'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {ev.outcome}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-emerald-400/80 text-[11px]">
                    {ev.integrity_link.substring(0, 16)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  Audit Event Record Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-500 font-sans block">Event ID:</span>
                  <span className="text-slate-200 select-all">{selectedEvent.event_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans block">Correlation ID:</span>
                  <span className="text-slate-200 select-all">{selectedEvent.correlation_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans block">Occurred At:</span>
                  <span className="text-slate-200">{selectedEvent.occurred_at}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans block">Actor (Role):</span>
                  <span className="text-slate-200">{selectedEvent.actor_id} ({selectedEvent.actor_role})</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-sans block mb-1">Cryptographic Integrity Link (SHA-256):</span>
                <div className="bg-slate-950 p-2.5 rounded border border-emerald-900 text-emerald-400 select-all break-all">
                  {selectedEvent.integrity_link}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-sans block mb-1">Sanitized Event Metadata (Zero Plaintext Secrets):</span>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto max-h-48 text-[11px]">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
