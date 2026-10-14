import React, { useState } from 'react';
import {
  Flame,
  X,
  ShieldAlert,
  Clock,
  Ticket,
  FileText,
  UserCheck,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { ConnectionProfile } from '../../domain/types';

interface BreakGlassModalProps {
  profiles: ConnectionProfile[];
  initialProfileId?: string;
  onClose: () => void;
  onGranted: (grant: { incidentTicketId: string; expiresAt: number; hostLabel: string }) => void;
}

export const BreakGlassModal: React.FC<BreakGlassModalProps> = ({
  profiles,
  initialProfileId,
  onClose,
  onGranted
}) => {
  const [profileId, setProfileId] = useState<string>(initialProfileId || (profiles[0]?.id || ''));
  const [requestedUser, setRequestedUser] = useState<string>('root');
  const [incidentTicketId, setIncidentTicketId] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTicketId.trim()) {
      setError('A valid Incident / Change Ticket ID (e.g. INC-10294) is mandatory for corporate audit compliance.');
      return;
    }
    if (!justification.trim() || justification.trim().length < 10) {
      setError('Please provide a substantive justification explanation (at least 10 characters).');
      return;
    }

    setLoading(true);
    setError(null);

    const targetProf = profiles.find((p) => p.id === profileId);
    const hostLabel = targetProf ? `${targetProf.display_name} (${targetProf.hostname})` : profileId;

    try {
      const grant = await (window as any).dgodterm.requestBreakGlassAccess(
        { profileId, label: hostLabel },
        requestedUser,
        incidentTicketId.trim(),
        justification.trim(),
        durationMinutes
      );

      onGranted({
        incidentTicketId: grant.incidentTicketId,
        expiresAt: grant.expiresAt,
        hostLabel
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to request break-glass access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-red-500/20 bg-red-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/20">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Just-In-Time (JIT) Break-Glass Escalation
              </h2>
              <p className="text-xs text-red-300/80 mt-0.5">
                Zero standing root privilege policy &bull; Ephemeral timed elevation
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 leading-relaxed flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>
              <strong>Audit Notice:</strong> Break-Glass access bypasses regular role limits for emergency remediation. All terminal I/O during this session is cryptographically timestamped and linked to your Incident ID.
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Server */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Target Linux Server
            </label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.username}@{p.hostname}:{p.port})
                </option>
              ))}
            </select>
          </div>

          {/* Requested User & Incident ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Elevated Account Role
              </label>
              <select
                value={requestedUser}
                onChange={(e) => setRequestedUser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-red-500"
              >
                <option value="root">root (Superuser)</option>
                <option value="wheel">wheel (Privileged Admin)</option>
                <option value="sudo">sudo (Operator)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Mandatory Ticket ID
              </label>
              <div className="relative">
                <Ticket className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. INC-84920"
                  value={incidentTicketId}
                  onChange={(e) => setIncidentTicketId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono uppercase focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Requested Session Duration (Auto-Revokes Upon Expiry)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                    durationMinutes === mins
                      ? 'border-red-500 bg-red-950/40 text-red-300 ring-1 ring-red-500/40'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{mins} mins</span>
                </button>
              ))}
            </div>
          </div>

          {/* Justification */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Business Justification & Remediation Plan
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Critical database deadlock incident INC-84920 requires inspect lock manager and kill frozen thread."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-red-500 resize-none leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              {loading ? 'Authorizing...' : 'Authorize Break-Glass'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
