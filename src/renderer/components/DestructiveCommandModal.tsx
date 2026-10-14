import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, Terminal, CheckCircle } from 'lucide-react';
import { DestructiveCommandAlert } from '../utils/command-safety';
import { ConnectionProfile } from '../../domain/types';

interface DestructiveCommandModalProps {
  alert: DestructiveCommandAlert;
  profile: ConnectionProfile;
  commandText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DestructiveCommandModal: React.FC<DestructiveCommandModalProps> = ({
  alert,
  profile,
  commandText,
  onConfirm,
  onCancel
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const isProduction = (profile.tags || []).some((t) => /prod/i.test(t)) || /prod/i.test(profile.display_name);
  const requiredPhrase = isProduction ? 'CONFIRM' : 'I UNDERSTAND';
  const isUnlocked = typedConfirmation.trim().toUpperCase() === requiredPhrase;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl w-full max-w-xl shadow-2xl shadow-red-950/50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-red-950/60 border-b border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                <span>Catastrophic Command Safeguard</span>
                {isProduction && (
                  <span className="text-[10px] bg-red-600 text-white font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    PRODUCTION
                  </span>
                )}
              </h3>
              <p className="text-xs text-red-300 font-medium">{alert.matchedRule}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/20 text-slate-300 space-y-1.5 leading-relaxed">
            <div className="font-semibold text-red-200 flex items-center gap-1.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Target: {profile.display_name} ({profile.username}@{profile.hostname})</span>
            </div>
            <p className="text-slate-300 text-[11px]">{alert.explanation}</p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Intercepted Command Input
            </label>
            <div className="p-3 rounded-lg bg-black/90 border border-slate-800 font-mono text-red-400 text-xs break-all max-h-36 overflow-y-auto">
              <code>{commandText}</code>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="text-xs text-slate-300 block font-medium">
              To bypass this safeguard and execute on <span className="text-white font-bold">{profile.hostname}</span>, type <span className="font-mono font-bold text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded border border-red-500/30">{requiredPhrase}</span> below:
            </label>
            <input
              type="text"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder={`Type "${requiredPhrase}" to authorize`}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 font-mono"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer text-xs"
          >
            Abort Command (Safe)
          </button>
          <button
            onClick={onConfirm}
            disabled={!isUnlocked}
            className={`px-5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
              isUnlocked
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Force Execute</span>
          </button>
        </div>
      </div>
    </div>
  );
};
