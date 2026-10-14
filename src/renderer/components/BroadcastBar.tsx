import React, { useState } from 'react';
import {
  Radio,
  CheckSquare,
  Square,
  AlertTriangle,
  Send,
  X,
  Layers,
  Terminal as TerminalIcon,
  ShieldAlert
} from 'lucide-react';
import { ConnectionProfile } from '../../domain/types';
import { TERMINAL_THEMES, getTerminalSettings } from '../settings/settings-manager';
import { SessionThemeDropdown } from './SessionThemeDropdown';

export interface ActiveSessionDescriptor {
  sessionId: string;
  profile: ConnectionProfile;
}

interface BroadcastBarProps {
  activeSessions: ActiveSessionDescriptor[];
  currentSessionId: string;
  onBroadcastData: (sessionIds: string[], data: string) => void;
  isBroadcasting: boolean;
  setIsBroadcasting: (val: boolean) => void;
}

export const BroadcastBar: React.FC<BroadcastBarProps> = ({
  activeSessions,
  currentSessionId,
  onBroadcastData,
  isBroadcasting,
  setIsBroadcasting
}) => {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(() =>
    activeSessions.map((s) => s.sessionId)
  );
  const [broadcastInput, setBroadcastInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [dangerousConfirm, setDangerousConfirm] = useState<string | null>(null);

  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`dgodterm:session-theme:${currentSessionId}`);
      if (saved && TERMINAL_THEMES[saved]) return saved;
      const curProfile = activeSessions.find((s) => s.sessionId === currentSessionId)?.profile;
      if (curProfile) {
        const profSaved = localStorage.getItem(`dgodterm:profile-theme:${curProfile.id}`);
        if (profSaved && TERMINAL_THEMES[profSaved]) return profSaved;
      }
    } catch (e) {}
    const ts = getTerminalSettings();
    return ts.themeId || 'dgod-dark';
  });

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(`dgodterm:session-theme:${currentSessionId}`);
      if (saved && TERMINAL_THEMES[saved]) {
        setActiveThemeId(saved);
        return;
      }
      const curProfile = activeSessions.find((s) => s.sessionId === currentSessionId)?.profile;
      if (curProfile) {
        const profSaved = localStorage.getItem(`dgodterm:profile-theme:${curProfile.id}`);
        if (profSaved && TERMINAL_THEMES[profSaved]) {
          setActiveThemeId(profSaved);
          return;
        }
      }
    } catch (e) {}
    const ts = getTerminalSettings();
    setActiveThemeId(ts.themeId || 'dgod-dark');
  }, [currentSessionId, activeSessions]);

  React.useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.sessionId === currentSessionId && e.detail?.themeId) {
        setActiveThemeId(e.detail.themeId);
      }
    };
    window.addEventListener('dgodterm:session-theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('dgodterm:session-theme-changed', handleThemeChange);
    };
  }, [currentSessionId]);

  const handleSelectTheme = (newThemeId: string) => {
    setActiveThemeId(newThemeId);
    try {
      localStorage.setItem(`dgodterm:session-theme:${currentSessionId}`, newThemeId);
      const curProfile = activeSessions.find((s) => s.sessionId === currentSessionId)?.profile;
      if (curProfile) {
        localStorage.setItem(`dgodterm:profile-theme:${curProfile.id}`, newThemeId);
      }
    } catch (e) {}
    window.dispatchEvent(
      new CustomEvent('dgodterm:session-theme-changed', {
        detail: { sessionId: currentSessionId, themeId: newThemeId }
      })
    );
  };

  // Keep selected sessions synchronized if sessions change
  React.useEffect(() => {
    setSelectedSessionIds((prev) => {
      const activeIds = new Set(activeSessions.map((s) => s.sessionId));
      const filtered = prev.filter((id) => activeIds.has(id));
      // if empty or newly joined, include current
      if (filtered.length === 0 && activeSessions.length > 0) {
        return activeSessions.map((s) => s.sessionId);
      }
      return filtered;
    });
  }, [activeSessions]);

  const toggleSelectSession = (id: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedSessionIds(activeSessions.map((s) => s.sessionId));
  };

  const selectNone = () => {
    setSelectedSessionIds([]);
  };

  const handleSend = () => {
    const text = broadcastInput.trim();
    if (!text || selectedSessionIds.length === 0) return;

    // Safety intercept for high risk commands
    const dangerousPatterns = [/rm\s+-rf/i, /reboot/i, /shutdown/i, />\s*\/dev\/sd/i, /mkfs/i];
    if (dangerousPatterns.some((p) => p.test(text))) {
      setDangerousConfirm(text);
      return;
    }

    executeBroadcast(text);
  };

  const executeBroadcast = (cmd: string) => {
    onBroadcastData(selectedSessionIds, cmd + '\n');
    setBroadcastInput('');
    setDangerousConfirm(null);
  };

  if (!isBroadcasting && activeSessions.length <= 1) {
    return null;
  }

  return (
    <>
      {/* Danger Confirmation Modal */}
      {dangerousConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-600/80 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
              <h3 className="text-base font-bold text-white">High-Risk Cluster Execution</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              You are about to execute a potentially destructive command simultaneously across{' '}
              <span className="font-bold text-rose-400">{selectedSessionIds.length} active servers</span>:
            </p>
            <div className="p-3 rounded-lg bg-black/70 border border-rose-900/60 font-mono text-xs text-rose-300 mb-5 break-all">
              {dangerousConfirm}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDangerousConfirm(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executeBroadcast(dangerousConfirm)}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                Confirm Cluster Execution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Broadcast Header Strip */}
      <div
        className={`px-4 py-2 flex items-center justify-between border-b transition-colors ${
          isBroadcasting
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
            : 'bg-slate-900/90 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBroadcasting(!isBroadcasting)}
            className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer shadow-sm ${
              isBroadcasting
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isBroadcasting ? 'animate-pulse' : ''}`} />
            <span>{isBroadcasting ? 'BROADCAST ACTIVE' : 'Enable Broadcast'}</span>
          </button>

          {isBroadcasting && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Targeting {selectedSessionIds.length} of {activeSessions.length} server(s)
              </span>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-[11px] underline text-amber-300 hover:text-white cursor-pointer ml-1"
              >
                {showConfig ? 'Hide Targets' : 'Select Targets'}
              </button>
            </div>
          )}
        </div>

        {/* Quick Broadcast Input Box */}
        {isBroadcasting && (
          <div className="flex items-center gap-2 flex-1 max-w-xl mx-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Type command to send to all selected servers..."
                value={broadcastInput}
                onChange={(e) => setBroadcastInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                className="w-full bg-black/60 border border-amber-600/60 rounded px-3 py-1 text-xs text-white placeholder:text-amber-300/40 font-mono outline-none focus:border-amber-400"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!broadcastInput.trim() || selectedSessionIds.length === 0}
              className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
            >
              <Send className="w-3 h-3" />
              <span>Send All</span>
            </button>
          </div>
        )}

        {/* Inbuilt Session Theme Selector (Kept on the session bar) */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Session Theme:</span>
          <SessionThemeDropdown
            currentThemeId={activeThemeId}
            onSelectTheme={handleSelectTheme}
          />
        </div>
      </div>

      {/* Target Selector Dropdown / Tray */}
      {isBroadcasting && showConfig && (
        <div className="px-4 py-2.5 bg-slate-950/90 border-b border-amber-900/50 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Targets:
          </span>
          {activeSessions.map((s) => {
            const isChecked = selectedSessionIds.includes(s.sessionId);
            return (
              <button
                key={s.sessionId}
                onClick={() => toggleSelectSession(s.sessionId)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono transition cursor-pointer ${
                  isChecked
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                }`}
              >
                {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>
                  {s.profile.display_name} ({s.profile.hostname})
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-[11px]">
            <button onClick={selectAll} className="text-slate-400 hover:text-white underline cursor-pointer">
              All
            </button>
            <button onClick={selectNone} className="text-slate-400 hover:text-white underline cursor-pointer">
              None
            </button>
          </div>
        </div>
      )}
    </>
  );
};
