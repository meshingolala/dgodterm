import React, { useState, useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  X,
  Video,
  Clock,
  FastForward,
  Copy,
  Check
} from 'lucide-react';
import { SessionRecording } from '../../domain/types';
import { getTerminalSettings, TERMINAL_THEMES } from '../settings/settings-manager';

interface SessionRecorderModalProps {
  recording: SessionRecording | null;
  onClose: () => void;
}

export const SessionRecorderModal: React.FC<SessionRecorderModalProps> = ({
  recording,
  onClose
}) => {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const lastAppliedEventIndexRef = useRef<number>(-1);
  const timerRef = useRef<any>(null);

  if (!recording) return null;

  const totalDuration =
    recording.events.length > 0
      ? recording.events[recording.events.length - 1][0]
      : 0;

  // Initialize read-only XTerm on mount
  useEffect(() => {
    if (!terminalContainerRef.current) return;

    const initialSettings = getTerminalSettings();
    const activeTheme = TERMINAL_THEMES[initialSettings.themeId] || TERMINAL_THEMES['dgod-dark'];

    const term = new XTerm({
      cursorBlink: false,
      disableStdin: true,
      fontFamily: initialSettings.fontFamily,
      fontSize: initialSettings.fontSize,
      lineHeight: initialSettings.lineHeight,
      fontWeight: initialSettings.fontWeight as any,
      scrollback: 10000,
      theme: activeTheme,
      cols: recording.width || 120,
      rows: recording.height || 40
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalContainerRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;
    lastAppliedEventIndexRef.current = -1;

    // Handle resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermInstance.current = null;
    };
  }, [recording]);

  // Synchronize terminal display with currentTime
  useEffect(() => {
    const term = xtermInstance.current;
    if (!term) return;

    // Find target event index
    let targetIndex = -1;
    for (let i = 0; i < recording.events.length; i++) {
      if (recording.events[i][0] <= currentTime) {
        targetIndex = i;
      } else {
        break;
      }
    }

    if (targetIndex < lastAppliedEventIndexRef.current) {
      // User scrubbed backwards: reset terminal and replay from 0 to targetIndex
      term.reset();
      for (let i = 0; i <= targetIndex; i++) {
        const [, type, data] = recording.events[i];
        if (type === 'o') {
          term.write(data);
        }
      }
      lastAppliedEventIndexRef.current = targetIndex;
    } else if (targetIndex > lastAppliedEventIndexRef.current) {
      // User scrubbed or played forwards: write only new events
      for (let i = lastAppliedEventIndexRef.current + 1; i <= targetIndex; i++) {
        const [, type, data] = recording.events[i];
        if (type === 'o') {
          term.write(data);
        }
      }
      lastAppliedEventIndexRef.current = targetIndex;
    }
  }, [currentTime, recording]);

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      const step = 0.05;
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + step * playbackSpeed;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDuration]);

  const handleDownloadAsciicast = () => {
    const header = JSON.stringify({
      version: 2,
      width: recording.width || 120,
      height: recording.height || 40,
      timestamp: Math.floor(recording.timestamp / 1000),
      title: recording.title,
      env: recording.env || { TERM: 'xterm-256color', SHELL: '/bin/bash' }
    });

    const lines = [header];
    for (const event of recording.events) {
      lines.push(JSON.stringify(event));
    }
    const fullText = lines.join('\n');

    const blob = new Blob([fullText], { type: 'application/x-asciicast' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.cast`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyRaw = () => {
    // Collect all text output up to current time
    let out = '';
    for (const [timestamp, type, data] of recording.events) {
      if (timestamp <= currentTime) {
        if (type === 'o') out += data;
      } else break;
    }
    navigator.clipboard.writeText(out);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl h-[84vh] rounded-2xl border border-slate-700 bg-slate-900 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Session Recording Playback</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  asciicast v2
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">{recording.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAsciicast}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer"
              title="Download .cast file for asciinema or audit archiving"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .cast</span>
            </button>
            <button
              onClick={handleCopyRaw}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Copy screen text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real Terminal Screen for ANSI Escape Sequence Rendering */}
        <div
          ref={terminalContainerRef}
          className="flex-1 bg-black p-3 overflow-hidden select-text border-b border-slate-800"
        />

        {/* Player Controls Bar */}
        <div className="px-5 py-3 bg-slate-950 flex flex-col gap-2 select-none">
          {/* Timeline Scrubber */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 w-12">{formatSec(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={totalDuration || 1}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                setCurrentTime(parseFloat(e.target.value));
              }}
              className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span className="text-xs font-mono text-slate-500 w-12 text-right">
              {formatSec(totalDuration)}
            </span>
          </div>

          {/* Buttons and Speed */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer shadow"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Rewind to start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <span className="text-xs text-slate-400">
                {recording.events.length} frames recorded
              </span>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <FastForward className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold">Speed:</span>
              {[0.5, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
