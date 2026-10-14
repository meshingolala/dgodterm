import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Terminal, Shield } from 'lucide-react';

interface TitleBarProps {
  activeSessionTitle?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ activeSessionTitle }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Initial maximized state check
    try {
      (window as any).dgodterm?.isWindowMaximized?.().then((max: boolean) => {
        setIsMaximized(Boolean(max));
      });
    } catch {}

    const unsub = (window as any).dgodterm?.onMaximizedChange?.((max: boolean) => {
      setIsMaximized(max);
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleMinimize = () => {
    try {
      (window as any).dgodterm?.minimizeWindow?.();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMaximize = () => {
    try {
      (window as any).dgodterm?.maximizeWindow?.().then((max: boolean) => {
        setIsMaximized(Boolean(max));
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleClose = () => {
    try {
      (window as any).dgodterm?.closeWindow?.();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="h-8 bg-[#080c14] border-b border-slate-800/90 flex items-center justify-between select-none shrink-0 relative z-50 text-slate-400"
      style={{ WebkitAppRegion: 'drag' } as any}
      onDoubleClick={handleToggleMaximize}
    >
      {/* Left: Brand Icon & App Title */}
      <div className="flex items-center gap-2 px-3 min-w-0" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="w-4 h-4 rounded bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
          <Terminal className="w-2.5 h-2.5" />
        </div>
        <span className="text-[11px] font-bold text-slate-200 tracking-wide whitespace-nowrap">
          DgodTerm
        </span>
        <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">|</span>
        <span className="text-[11px] text-slate-400 truncate hidden md:inline font-sans">
          {activeSessionTitle ? `Session: ${activeSessionTitle}` : 'Zero-Trust Fleet Automation'}
        </span>
      </div>

      {/* Middle: Draggable Spacer */}
      <div className="flex-1 h-full" style={{ WebkitAppRegion: 'drag' } as any} />

      {/* Right: Window Controls (Minimize, Maximize/Restore, Close) */}
      <div className="flex items-center h-full shrink-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          type="button"
          onClick={handleMinimize}
          className="h-full px-3.5 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          className="h-full px-3.5 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={isMaximized ? 'Restore Down' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="h-full px-3.5 flex items-center justify-center hover:bg-rose-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
