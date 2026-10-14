import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, KeyRound, Lock, ExternalLink } from 'lucide-react';

interface HostVerificationModalProps {
  promptData: {
    sessionId: string;
    result: {
      status: 'unknown' | 'mismatch';
      hostname: string;
      port: number;
      keyType: string;
      fingerprint: string;
      rawPublicKey: string;
      existingRecord?: any;
    };
  };
  onResolve: (accept: boolean, rotationData?: any) => void;
}

export const HostVerificationModal: React.FC<HostVerificationModalProps> = ({ promptData, onResolve }) => {
  const { result } = promptData;
  const isMismatch = result.status === 'mismatch';

  const [rotationReason, setRotationReason] = useState('');
  const [changeReference, setChangeReference] = useState('');
  const [operatorId, setOperatorId] = useState('operator');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAcceptUnknown = () => {
    onResolve(true);
  };

  const handleAuthorizeRotation = () => {
    if (!rotationReason.trim() || !changeReference.trim()) {
      setErrorMsg('Both an authorized rotation reason and a Change Reference ticket are strictly required.');
      return;
    }

    onResolve(true, {
      recordId: result.existingRecord?.id,
      newFingerprint: result.fingerprint,
      newKeyType: result.keyType,
      newRawKey: result.rawPublicKey,
      verifiedBy: operatorId,
      changeReference,
      reason: rotationReason
    });
  };

  const handleReject = () => {
    onResolve(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`w-full max-w-xl rounded-xl border p-6 shadow-2xl ${
        isMismatch ? 'bg-red-950/30 border-red-500/50' : 'bg-slate-900 border-amber-500/50'
      }`}>
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${isMismatch ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {isMismatch ? <ShieldAlert className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {isMismatch ? 'CRITICAL: Host Key Identification Changed!' : 'Unknown Host Key — Verification Required'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              DgodTerm enforces strict host identity verification. Silent acceptance is prevented.
            </p>
          </div>
        </div>

        {/* Mismatch Warning Alert */}
        {isMismatch && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <strong>POSSIBLE MAN-IN-THE-MIDDLE ATTACK!</strong> The fingerprint presented by this server differs
              from the fingerprint previously stored in your trusted host records. Do not proceed unless you have
              confirmed a legitimate server rebuild or key rotation with your infrastructure team.
            </div>
          </div>
        )}

        {/* Host Details Grid */}
        <div className="mt-4 bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs">
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans">Target Endpoint:</span>
            <span className="text-slate-200 font-semibold">{result.hostname}:{result.port}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-sans">Key Algorithm:</span>
            <span className="text-indigo-400">{result.keyType}</span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 font-sans block">
              {isMismatch ? 'Presented Fingerprint (New):' : 'Host Key Fingerprint (SHA-256):'}
            </span>
            <div className="bg-slate-900 border border-slate-700 p-2 rounded text-emerald-400 break-all select-all font-mono font-medium">
              {result.fingerprint}
            </div>
          </div>

          {isMismatch && result.existingRecord && (
            <div className="space-y-1 pt-1">
              <span className="text-slate-400 font-sans block">Previously Trusted Fingerprint (Old):</span>
              <div className="bg-slate-900 border border-red-900/50 p-2 rounded text-red-400 break-all select-all font-mono font-medium">
                {result.existingRecord.key_or_ca_fingerprint}
              </div>
            </div>
          )}
        </div>

        {/* Verification Guidance */}
        <div className="mt-3 text-xs text-slate-400 flex items-start gap-2 bg-slate-800/40 p-2.5 rounded">
          <KeyRound className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            Compare this SHA-256 fingerprint with your organization’s out-of-band records or host deployment manifest before accepting.
          </span>
        </div>

        {/* Rotation Form if Mismatch */}
        {isMismatch && (
          <div className="mt-4 space-y-3 bg-slate-900/80 p-3 rounded-lg border border-red-900/40">
            <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Authorized Key Rotation Workflow
            </div>
            {errorMsg && <div className="text-xs text-red-400 font-medium">{errorMsg}</div>}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Change Reference / Ticket ID *</label>
                <input
                  type="text"
                  placeholder="e.g. CR-90241"
                  value={changeReference}
                  onChange={(e) => setChangeReference(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Operator Identity</label>
                <input
                  type="text"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Documented Reason for Host Key Change *</label>
              <input
                type="text"
                placeholder="e.g. Host re-provisioned via Ansible on 2026-10-07"
                value={rotationReason}
                onChange={(e) => setRotationReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="mt-6 flex justify-end items-center gap-3">
          <button
            onClick={handleReject}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
          >
            Reject and Abort Connection
          </button>

          {isMismatch ? (
            <button
              onClick={handleAuthorizeRotation}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              Authorize Key Rotation
            </button>
          ) : (
            <button
              onClick={handleAcceptUnknown}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Accept and Trust Host Key
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
