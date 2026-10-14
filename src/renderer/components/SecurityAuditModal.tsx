import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface AuditCheckResult {
  id: string;
  title: string;
  category: string;
  severity: 'pass' | 'warning' | 'critical';
  evidence: string;
  explanation: string;
  remediation?: string;
}

interface SecurityAuditReport {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  passedCount: number;
  warningCount: number;
  criticalCount: number;
  checks: AuditCheckResult[];
  hostIdentifier: string;
  scannedAt: string;
}

interface SecurityAuditModalProps {
  target: { sessionId?: string; profileId?: string; label: string };
  onClose: () => void;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({ target, onClose }) => {
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [copiedRemediationId, setCopiedRemediationId] = useState<string | null>(null);
  const [copiedFullReport, setCopiedFullReport] = useState(false);

  const targetId = `${target.sessionId || ''}:${target.profileId || ''}`;

  useEffect(() => {
    runAudit();
  }, [targetId]);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await (window as any).dgodterm.runSecurityAudit(target);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Security compliance audit failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRemediation = (id: string, cmd: string) => {
    copyTextToClipboard(cmd);
    setCopiedRemediationId(id);
    setTimeout(() => setCopiedRemediationId(null), 2000);
  };

  const handleCopyFullReport = () => {
    if (!report) return;
    const lines = [
      `=== DGODTERM LINUX SECURITY & HARDENING COMPLIANCE AUDIT ===`,
      `Target Host: ${report.hostIdentifier}`,
      `Scan Date: ${report.scannedAt}`,
      `Compliance Score: ${report.score}/100 (Grade: ${report.grade})`,
      `Passed: ${report.passedCount} | Warnings: ${report.warningCount} | Critical: ${report.criticalCount}`,
      `\n--- DETAILED FINDINGS ---`
    ];

    for (const c of report.checks) {
      lines.push(`\n[${c.severity.toUpperCase()}] ${c.title} (${c.category})`);
      lines.push(`Explanation: ${c.explanation}`);
      lines.push(`Evidence: ${c.evidence}`);
      if (c.remediation) {
        lines.push(`Remediation Command: ${c.remediation}`);
      }
    }

    copyTextToClipboard(lines.join('\n'));
    setCopiedFullReport(true);
    setTimeout(() => setCopiedFullReport(false), 2000);
  };

  const gradeColor =
    report?.grade === 'A+' || report?.grade === 'A'
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : report?.grade === 'B'
      ? 'text-sky-400 border-sky-500/40 bg-sky-500/10'
      : report?.grade === 'C'
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-red-400 border-red-500/40 bg-red-500/10';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Linux Security & Hardening Compliance Audit
                </h2>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono">
                  {target.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated 10-point CIS benchmark check: SSH policies, firewall, sudoers, file permissions, and kernel sysctls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runAudit}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              {loading ? 'Scanning...' : 'Re-Scan'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Executive Score Summary Banner */}
        {report && (
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-bold tracking-tight shadow-lg ${gradeColor}`}
              >
                <span className="text-2xl leading-none">{report.grade}</span>
                <span className="text-[10px] uppercase font-sans mt-0.5">{report.score}/100</span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Compliance Posture: {report.score >= 85 ? 'Hardened & Compliant' : report.score >= 70 ? 'Moderate Posture (Action Recommended)' : 'High Risk Violations Detected'}
                  </h3>
                  {loading && (
                    <span className="flex items-center gap-1 text-[11px] text-sky-400 font-medium animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Updating scan...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs mt-1">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {report.passedCount} Passed
                  </span>
                  <span className="flex items-center gap-1 text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> {report.warningCount} Warnings
                  </span>
                  <span className="flex items-center gap-1 text-red-400 font-semibold">
                    <ShieldX className="w-3.5 h-3.5" /> {report.criticalCount} Critical
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyFullReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-700"
            >
              {copiedFullReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedFullReport ? 'Report Copied' : 'Export Full Audit'}
            </button>
          </div>
        )}

        {/* Audit Findings List */}
        <div className="flex-1 overflow-auto p-6 space-y-3 bg-[#070b12]">
          {loading && !report ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs">Executing non-destructive security benchmark queries on {target.label}...</p>
            </div>
          ) : error && !report ? (
            <div className="p-12 text-center text-red-400 text-xs">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
              {error}
            </div>
          ) : !report ? null : (
            report.checks.map((check) => {
              const isExpanded = expandedCheckId === check.id;
              const isPass = check.severity === 'pass';
              const isWarning = check.severity === 'warning';
              const isCritical = check.severity === 'critical';

              return (
                <div
                  key={check.id}
                  className={`rounded-xl border transition-all ${
                    isCritical
                      ? 'border-red-500/30 bg-red-950/10'
                      : isWarning
                      ? 'border-amber-500/30 bg-amber-950/10'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div
                    onClick={() => setExpandedCheckId(isExpanded ? null : check.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {isCritical ? (
                        <ShieldX className="w-5 h-5 text-red-400 shrink-0" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white tracking-wide">
                            {check.title}
                          </h4>
                          <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 uppercase">
                            {check.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {check.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isCritical
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : isWarning
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {check.severity}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Evidence & Remediation */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3">
                      {/* Evidence */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Server Evidence Output
                        </label>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap select-text">
                          {check.evidence}
                        </div>
                      </div>

                      {/* Remediation */}
                      {check.remediation && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                              Suggested Remediation Shell Command
                            </label>
                            <button
                              onClick={() => handleCopyRemediation(check.id, check.remediation!)}
                              className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                            >
                              {copiedRemediationId === check.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              {copiedRemediationId === check.id ? 'Copied' : 'Copy Fix'}
                            </button>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 font-mono text-[11px] text-amber-200 select-text flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span className="flex-1 break-all">{check.remediation}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Read-only non-intrusive compliance scan. Verification signed into cryptographic audit ledger.
          </span>
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
