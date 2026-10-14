import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ConnectionProfile } from '../../domain/types';
import { ClipboardPasteModal } from './ClipboardPasteModal';
import { PasswordPromptModal } from './PasswordPromptModal';
import {
  Search,
  RefreshCw,
  PowerOff,
  ShieldCheck,
  Activity,
  Copy,
  Terminal as TerminalIcon,
  X,
  KeyRound,
  Lock,
  ClipboardPaste,
  Check,
  CheckSquare,
  Eraser,
  Code,
  Video,
  Circle,
  Cpu,
  Layers,
  Radio,
  Boxes,
  Columns,
  Rows,
  Sparkles,
  Wrench,
  FileText,
  ChevronDown
} from 'lucide-react';
import { getTerminalSettings, TERMINAL_THEMES, TerminalSettings, getEffectiveThemeBackground } from '../settings/settings-manager';
import { copyTextToClipboard, readTextFromClipboard } from '../utils/clipboard-utils';
import { SnippetsModal } from './SnippetsModal';
import { HealthMonitorWidget } from './HealthMonitorWidget';
import { SessionRecorderModal } from './SessionRecorderModal';
import { SystemdServicesModal } from './SystemdServicesModal';
import { NetworkPortsModal } from './NetworkPortsModal';
import { SecurityAuditModal } from './SecurityAuditModal';
import { DockerInspectorModal } from './DockerInspectorModal';
import { HostNotesModal } from './HostNotesModal';
import { DistroIcon } from './DistroIcon';
import { ProcessManagerModal } from './ProcessManagerModal';
import { AICopilotPanel } from './AICopilotPanel';
import { SessionRecording } from '../../domain/types';

import { checkDestructiveCommand, DestructiveCommandAlert } from '../utils/command-safety';
import { DestructiveCommandModal } from './DestructiveCommandModal';

interface TerminalViewProps {
  sessionId: string;
  profile: ConnectionProfile;
  isActive?: boolean;
  onClose: () => void;
  onRequestPassword?: (sessionId: string, profile: ConnectionProfile) => void;
  initialCommand?: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  profile,
  isActive = true,
  onClose,
  onRequestPassword,
  initialCommand
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const initialCommandRanRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingPasteText, setPendingPasteText] = useState<string | null>(null);

  // Auto-Reconnect & Connection Self-Healing State
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectTimerRef = useRef<any>(null);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);

  // Destructive Command Interceptor State
  const [pendingDestructiveAlert, setPendingDestructiveAlert] = useState<{
    alert: DestructiveCommandAlert;
    command: string;
  } | null>(null);

  // In-terminal password prompt modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordPromptText, setPasswordPromptText] = useState('');

  // Snippets modal
  const [showSnippetsModal, setShowSnippetsModal] = useState(false);

  // Health Monitor state
  const [showHealthMonitor, setShowHealthMonitor] = useState(false);
  const [expandProcesses, setExpandProcesses] = useState(false);

  // Session Recording state (asciicast v2)
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordedEventsRef = useRef<[number, string, string][]>([]);
  const [completedRecording, setCompletedRecording] = useState<SessionRecording | null>(null);

  // Corporate Linux Fleet Operations Modals
  const [showSystemdModal, setShowSystemdModal] = useState(false);
  const [showNetworkPortsModal, setShowNetworkPortsModal] = useState(false);
  const [showSecurityAuditModal, setShowSecurityAuditModal] = useState(false);

  // Split-Screen Terminal Multiplexer State
  const [splitMode, setSplitMode] = useState<'none' | 'vertical' | 'horizontal'>('none');
  const [activePane, setActivePane] = useState<'primary' | 'secondary'>('primary');
  const [secondarySessionId, setSecondarySessionId] = useState<string | null>(null);
  const [secondaryConnected, setSecondaryConnected] = useState(false);
  const secondaryTerminalRef = useRef<HTMLDivElement>(null);
  const secondaryXtermInstance = useRef<XTerm | null>(null);
  const secondaryFitAddonRef = useRef<FitAddon | null>(null);

  // New Feature Modals & Drawers
  const [showDockerModal, setShowDockerModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<ConnectionProfile>(profile);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  const getTargetSessionId = () => {
    return activePane === 'secondary' && secondarySessionId ? secondarySessionId : sessionId;
  };

  const modalTarget = useMemo(() => ({
    sessionId,
    profileId: profile.id,
    label: `${profile.display_name} (${profile.username}@${profile.hostname})`
  }), [sessionId, profile.id, profile.display_name, profile.username, profile.hostname]);

  const activeModalTarget = useMemo(() => {
    const targetSession = activePane === 'secondary' && secondarySessionId ? secondarySessionId : sessionId;
    return {
      sessionId: targetSession,
      profileId: profile.id,
      label: `${profile.display_name} (${profile.username}@${profile.hostname})`
    };
  }, [sessionId, activePane, secondarySessionId, profile.id, profile.display_name, profile.username, profile.hostname]);

  const startSplit = (mode: 'vertical' | 'horizontal') => {
    const secId = `${sessionId}-split-${Date.now().toString(36)}`;
    setSecondarySessionId(secId);
    setSplitMode(mode);
    setActivePane('secondary');
  };

  const closeSplit = () => {
    if (secondarySessionId) {
      try {
        (window as any).dgodterm?.disconnectSSH?.(secondarySessionId);
      } catch (e) {}
    }
    setSplitMode('none');
    setSecondarySessionId(null);
    setActivePane('primary');
    setTimeout(() => {
      fitAddonRef.current?.fit();
      xtermInstance.current?.focus();
    }, 100);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      // Start recording
      recordingStartTimeRef.current = Date.now();
      recordedEventsRef.current = [];
      setIsRecording(true);
      showToast('Recording started (asciicast format)');
    } else {
      // Stop recording and show playback modal
      setIsRecording(false);
      const cols = xtermInstance.current?.cols || 120;
      const rows = xtermInstance.current?.rows || 40;
      const rec: SessionRecording = {
        version: 2,
        width: cols,
        height: rows,
        timestamp: Math.floor((recordingStartTimeRef.current || Date.now()) / 1000),
        title: `${profile.display_name} (${profile.username}@${profile.hostname})`,
        env: { TERM: 'xterm-256color', SHELL: '/bin/bash' },
        events: recordedEventsRef.current
      };
      setCompletedRecording(rec);
      showToast('Recording saved!');
    }
  };

  const handleInsertSnippet = (cmd: string) => {
    const targetSession = getTargetSessionId();
    if (profile.id.startsWith('local-')) {
      (window as any).dgodterm?.sendLocalData?.(targetSession, cmd + '\n');
      showToast('Snippet sent to local terminal');
    } else if ((window as any).dgodterm?.sendSSHData) {
      (window as any).dgodterm.sendSSHData(targetSession, cmd + '\n');
      showToast('Snippet sent to terminal');
    } else if (activePane === 'secondary' && secondaryXtermInstance.current) {
      secondaryXtermInstance.current.paste(cmd);
      showToast('Snippet inserted');
    } else if (xtermInstance.current) {
      xtermInstance.current.paste(cmd);
      showToast('Snippet inserted');
    }
  };

  // Right-click context menu state
  const [terminalContextMenu, setTerminalContextMenu] = useState<{
    x: number;
    y: number;
    hasSelection: boolean;
  } | null>(null);

  // Transient copy/paste toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target as Node)) {
        setShowToolsDropdown(false);
      }
    };
    if (showToolsDropdown) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showToolsDropdown]);

  const [currentThemeBg, setCurrentThemeBg] = useState(() => {
    const ts = getTerminalSettings();
    return getEffectiveThemeBackground(ts.themeId, ts.backgroundOpacity);
  });
  const [paddingPx, setPaddingPx] = useState(() => {
    return getTerminalSettings().windowPadding ?? 8;
  });

  useEffect(() => {
    if (!terminalRef.current) return;

    const initialSettings = getTerminalSettings();
    const activeTheme = TERMINAL_THEMES[initialSettings.themeId] || TERMINAL_THEMES['dgod-dark'];
    const effectiveBg = getEffectiveThemeBackground(initialSettings.themeId, initialSettings.backgroundOpacity);
    const initialIsTransparent = effectiveBg.startsWith('rgba') || effectiveBg === 'transparent';

    const term = new XTerm({
      allowTransparency: true,
      cursorBlink: initialSettings.cursorBlink,
      cursorStyle: initialSettings.cursorStyle,
      fontFamily: initialSettings.fontFamily,
      fontSize: initialSettings.fontSize,
      lineHeight: initialSettings.lineHeight,
      fontWeight: initialSettings.fontWeight as any,
      scrollback: initialSettings.scrollback,
      theme: {
        ...activeTheme,
        background: initialIsTransparent ? 'transparent' : effectiveBg,
        cursor: initialSettings.cursorColor || activeTheme.cursor
      }
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const isLocalShell = profile.id.startsWith('local-');

    if (isLocalShell) {
      const shellType = profile.id.replace('local-', '');
      term.writeln(`\x1b[38;5;39m[DgodTerm Local]\x1b[0m Spawning \x1b[1m${profile.display_name}\x1b[0m terminal...`);
      term.writeln(`\x1b[38;5;244mShell: ${shellType} | Mode: Native PTY (ConPTY) | Integration: Desktop App\x1b[0m\r\n`);
      (window as any).dgodterm.spawnLocalShell?.(sessionId, shellType, term.cols, term.rows);
      setConnected(true);
    } else {
      term.writeln(`\x1b[38;5;39m[DgodTerm]\x1b[0m Initializing secure SSH connection to \x1b[1m${profile.username}@${profile.hostname}:${profile.port}\x1b[0m...`);
      term.writeln(`\x1b[38;5;244mHost Identity Policy: STRICT | Verification: Mandated | Redaction: ACTIVE\x1b[0m\r\n`);

      // Connect via backend
      (window as any).dgodterm.connectSSH(sessionId, profile.id, term.cols, term.rows);
      setConnected(true);
    }

    // Terminal data input
    term.onData((data) => {
      window.dispatchEvent(new Event('dgodterm:user-activity'));
      if (isLocalShell) {
        (window as any).dgodterm.sendLocalData?.(sessionId, data);
      } else {
        (window as any).dgodterm.sendSSHData(sessionId, data);
      }
      if (recordingStartTimeRef.current !== null) {
        const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
        recordedEventsRef.current.push([elapsed, 'i', data]);
      }
    });

    // Copy on selection (if enabled in settings)
    term.onSelectionChange(() => {
      const cur = getTerminalSettings();
      if (cur.copyOnSelect && term.hasSelection()) {
        const text = term.getSelection();
        if (text) {
          copyTextToClipboard(text);
        }
      }
    });

    // Keyboard shortcuts: Ctrl+Shift+C (Copy), Ctrl+Shift+V (Paste)
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        if (term.hasSelection()) {
          const text = term.getSelection();
          if (text) {
            copyTextToClipboard(text);
            showToast('Copied to clipboard');
          }
        }
        return false;
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
        readTextFromClipboard().then((text) => {
          if (!text) {
            showToast('Clipboard is empty');
            return;
          }

          // Catastrophic Command Safeguard
          const alert = checkDestructiveCommand(text);
          if (alert) {
            setPendingDestructiveAlert({ alert, command: text });
            return;
          }

          if (text.includes('\n') || text.includes('\r')) {
            setPendingPasteText(text);
          } else {
            if (isLocalShell) {
              (window as any).dgodterm?.sendLocalData?.(sessionId, text);
            } else {
              (window as any).dgodterm?.sendSSHData?.(sessionId, text);
            }
          }
        });
        return false;
      }
      return true;
    });

    // Listen to incoming SSH data
    const unsubscribeData = (window as any).dgodterm.onSSHData((targetSessionId: string, chunk: string) => {
      if (targetSessionId === sessionId) {
        term.write(chunk);
        if (recordingStartTimeRef.current !== null) {
          const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
          recordedEventsRef.current.push([elapsed, 'o', chunk]);
        }
        if (initialCommand && !initialCommandRanRef.current) {
          initialCommandRanRef.current = true;
          setTimeout(() => {
            (window as any).dgodterm?.sendSSHData?.(sessionId, initialCommand + '\n');
            showToast('Snippet executed in terminal');
          }, 400);
        }
      }
    });

    // Listen to incoming local shell data
    const unsubscribeLocalData = (window as any).dgodterm.onLocalData?.((targetSessionId: string, chunk: string) => {
      if (targetSessionId === sessionId) {
        term.write(chunk);
        if (recordingStartTimeRef.current !== null) {
          const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
          recordedEventsRef.current.push([elapsed, 'o', chunk]);
        }
      }
    });

    const unsubscribeLocalClose = (window as any).dgodterm.onLocalClose?.((targetSessionId: string, code: number) => {
      if (targetSessionId === sessionId) {
        setConnected(false);
        term.writeln(`\r\n\x1b[38;5;244m[Local shell process exited with code ${code}]\x1b[0m\r\n`);
      }
    });

    const unsubscribeClose = (window as any).dgodterm.onSSHClose((targetSessionId: string, code: number) => {
      if (targetSessionId === sessionId) {
        setConnected(false);
        term.writeln(`\r\n\x1b[38;5;196m[DgodTerm] Connection lost (exit code: ${code}).\x1b[0m`);

        // Trigger native desktop notification on dropped connection
        if (code !== 0) {
          try {
            (window as any).dgodterm?.showNotification?.(
              'Connection Interrupted',
              `SSH session to ${profile.display_name} (${profile.hostname}) was closed unexpectedly.`
            );
          } catch {}
        }

        // If closed abnormally (non-zero or unexpected network reset), attempt auto-reconnect
        if (code !== 0 && !reconnectTimerRef.current) {
          setIsAutoReconnecting(true);
          const nextAttempt = reconnectAttempt + 1;
          setReconnectAttempt(nextAttempt);

          const delaySec = Math.min(30, Math.pow(2, Math.min(nextAttempt, 5)));
          term.writeln(`\x1b[38;5;214m[DgodTerm Watchdog] Auto-reconnecting in ${delaySec}s (Attempt ${nextAttempt}/5)... Press Reconnect to force.\x1b[0m`);

          if (nextAttempt <= 5) {
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              term.writeln(`\x1b[38;5;39m[DgodTerm Watchdog]\x1b[0m Retrying connection to ${profile.hostname}...`);
              (window as any).dgodterm.connectSSH(sessionId, profile.id, term.cols, term.rows);
              setConnected(true);
              setIsAutoReconnecting(false);
            }, delaySec * 1000);
          } else {
            setIsAutoReconnecting(false);
            term.writeln(`\x1b[38;5;196m[DgodTerm Watchdog] Auto-reconnect limit reached. Click Reconnect manually.\x1b[0m`);
          }
        }
      }
    });

    const unsubscribeError = (window as any).dgodterm.onSSHError((targetSessionId: string, error: string) => {
      if (targetSessionId === sessionId) {
        term.writeln(`\r\n\x1b[38;5;196m[DgodTerm Error] ${error}\x1b[0m`);
      }
    });

    // Handle resize
    const handleResize = () => {
      try {
        fitAddon.fit();
        if (isLocalShell) {
          (window as any).dgodterm?.resizeLocalShell?.(sessionId, term.cols, term.rows);
        } else {
          (window as any).dgodterm?.resizeSSH?.(sessionId, term.cols, term.rows);
        }
      } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    // Watch for container element resizes (e.g., when sidebar is dragged)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(terminalRef.current);
    }

    // Listen for live terminal appearance settings update
    const handleSettingsUpdated = (e: any) => {
      const updated: TerminalSettings = e.detail;
      if (!term || !fitAddon) return;
      term.options.fontFamily = updated.fontFamily;
      term.options.fontSize = updated.fontSize;
      term.options.lineHeight = updated.lineHeight;
      term.options.fontWeight = updated.fontWeight as any;
      term.options.cursorStyle = updated.cursorStyle;
      term.options.cursorBlink = updated.cursorBlink;
      term.options.scrollback = updated.scrollback;
      const themeDef = TERMINAL_THEMES[updated.themeId] || TERMINAL_THEMES['dgod-dark'];
      const effectiveBg = getEffectiveThemeBackground(updated.themeId, updated.backgroundOpacity);
      const updatedIsTransparent = effectiveBg.startsWith('rgba') || effectiveBg === 'transparent';
      term.options.theme = {
        ...themeDef,
        background: updatedIsTransparent ? 'transparent' : effectiveBg,
        cursor: updated.cursorColor || themeDef.cursor
      };
      setCurrentThemeBg(effectiveBg);
      setPaddingPx(updated.windowPadding ?? 8);
      setTimeout(() => {
        fitAddon.fit();
        (window as any).dgodterm.resizeSSH(sessionId, term.cols, term.rows);
      }, 50);
    };
    window.addEventListener('dgodterm:terminal-settings-updated', handleSettingsUpdated);

    // Right-click context menu & Direct copy/paste
    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault();
      const cur = getTerminalSettings();

      // If user holds Shift OR rightClickPaste is disabled in settings -> Show Context Menu
      if (e.shiftKey || !cur.rightClickPaste) {
        setTerminalContextMenu({
          x: e.clientX,
          y: e.clientY,
          hasSelection: term.hasSelection()
        });
        return;
      }

      // PuTTY / Windows Terminal standard behavior:
      // 1. If text IS selected: Right-click COPIES selected text!
      if (term.hasSelection()) {
        const text = term.getSelection();
        if (text) {
          const copied = await copyTextToClipboard(text);
          if (copied) {
            term.clearSelection();
            showToast('Copied to clipboard');
          }
        }
        return;
      }

      // 2. If NO text is selected: Right-click PASTES from clipboard!
      const text = await readTextFromClipboard();
      if (!text) {
        showToast('Clipboard is empty');
        return;
      }

      // Catastrophic Command Safeguard
      const alert = checkDestructiveCommand(text);
      if (alert) {
        setPendingDestructiveAlert({ alert, command: text });
        return;
      }

      if (text.includes('\n') || text.includes('\r')) {
        setPendingPasteText(text);
      } else {
        if (isLocalShell) {
          (window as any).dgodterm?.sendLocalData?.(sessionId, text);
        } else {
          (window as any).dgodterm?.sendSSHData?.(sessionId, text);
        }
      }
    };
    const terminalEl = terminalRef.current;
    terminalEl.addEventListener('contextmenu', handleContextMenu);

    // Intercept native paste event for multi-line defense
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (!text) return;

      const alert = checkDestructiveCommand(text);
      if (alert) {
        e.preventDefault();
        setPendingDestructiveAlert({ alert, command: text });
        return;
      }

      if (text.includes('\n') || text.includes('\r')) {
        e.preventDefault();
        setPendingPasteText(text);
      }
    };
    terminalEl.addEventListener('paste', handlePaste);

    // Close terminal context menu on global click
    const handleGlobalClick = () => setTerminalContextMenu(null);
    window.addEventListener('click', handleGlobalClick);

    // Report user activity on pointer/wheel inside terminal
    const handleTerminalActivity = () => {
      window.dispatchEvent(new Event('dgodterm:user-activity'));
    };
    terminalEl.addEventListener('pointerdown', handleTerminalActivity, { passive: true });
    terminalEl.addEventListener('wheel', handleTerminalActivity, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('dgodterm:terminal-settings-updated', handleSettingsUpdated);
      window.removeEventListener('click', handleGlobalClick);
      terminalEl.removeEventListener('contextmenu', handleContextMenu);
      terminalEl.removeEventListener('paste', handlePaste);
      terminalEl.removeEventListener('pointerdown', handleTerminalActivity);
      terminalEl.removeEventListener('wheel', handleTerminalActivity);
      if (isLocalShell) {
        try {
          (window as any).dgodterm?.closeLocalShell?.(sessionId);
        } catch {}
      }
      if (unsubscribeLocalData) unsubscribeLocalData();
      if (unsubscribeLocalClose) unsubscribeLocalClose();
      unsubscribeData();
      unsubscribeClose();
      unsubscribeError();
      term.dispose();
    };
  }, [sessionId, profile.id]);


  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermInstance.current) {
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          xtermInstance.current?.focus();
        } catch (e) {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Split pane terminal initialization and lifecycle
  useEffect(() => {
    if (!secondarySessionId || !secondaryTerminalRef.current) return;

    const initialSettings = getTerminalSettings();
    const activeTheme = TERMINAL_THEMES[initialSettings.themeId] || TERMINAL_THEMES['dgod-dark'];
    const effectiveBg = getEffectiveThemeBackground(initialSettings.themeId, initialSettings.backgroundOpacity);
    const initialIsTransparent = effectiveBg.startsWith('rgba') || effectiveBg === 'transparent';

    const secTerm = new XTerm({
      allowTransparency: true,
      cursorBlink: initialSettings.cursorBlink,
      cursorStyle: initialSettings.cursorStyle,
      fontFamily: initialSettings.fontFamily,
      fontSize: initialSettings.fontSize,
      lineHeight: initialSettings.lineHeight,
      fontWeight: initialSettings.fontWeight as any,
      scrollback: initialSettings.scrollback,
      theme: {
        ...activeTheme,
        background: initialIsTransparent ? 'transparent' : effectiveBg,
        cursor: initialSettings.cursorColor || activeTheme.cursor
      }
    });

    const fitAddon = new FitAddon();
    const webLinks = new WebLinksAddon();
    secTerm.loadAddon(fitAddon);
    secTerm.loadAddon(webLinks);

    secTerm.open(secondaryTerminalRef.current);
    fitAddon.fit();

    secondaryXtermInstance.current = secTerm;
    secondaryFitAddonRef.current = fitAddon;

    secTerm.writeln(`\x1b[38;5;39m[DgodTerm Split Pane]\x1b[0m Multiplexing connection to \x1b[1m${profile.username}@${profile.hostname}:${profile.port}\x1b[0m...`);

    (window as any).dgodterm.connectSSH(secondarySessionId, profile.id, secTerm.cols, secTerm.rows);
    setSecondaryConnected(true);

    secTerm.onData((data) => {
      (window as any).dgodterm.sendSSHData(secondarySessionId, data);
    });

    const unsubData = (window as any).dgodterm.onSSHData((targetSessionId: string, chunk: string) => {
      if (targetSessionId === secondarySessionId) {
        secTerm.write(chunk);
      }
    });

    const unsubClose = (window as any).dgodterm.onSSHClose((targetSessionId: string, code: number) => {
      if (targetSessionId === secondarySessionId) {
        setSecondaryConnected(false);
        secTerm.writeln(`\r\n\x1b[38;5;196m[DgodTerm] Split pane disconnected (code: ${code}).\x1b[0m`);
      }
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
        (window as any).dgodterm.resizeSSH(secondarySessionId, secTerm.cols, secTerm.rows);
      } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unsubData();
      unsubClose();
      try {
        (window as any).dgodterm?.disconnectSSH?.(secondarySessionId);
      } catch (e) {}
      secTerm.dispose();
      secondaryXtermInstance.current = null;
      secondaryFitAddonRef.current = null;
    };
  }, [secondarySessionId, profile.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
        secondaryFitAddonRef.current?.fit();
      } catch (e) {}
    }, 120);
    return () => clearTimeout(timer);
  }, [splitMode]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchAddonRef.current && query) {
      searchAddonRef.current.findNext(query);
    }
  };

  const handleReconnect = () => {
    const isLocalShell = profile.id.startsWith('local-');
    if (xtermInstance.current) {
      if (isLocalShell) {
        const shellType = profile.id.replace('local-', '');
        xtermInstance.current.writeln(`\r\n\x1b[38;5;39m[DgodTerm]\x1b[0m Restarting local ${profile.display_name}...`);
        (window as any).dgodterm?.spawnLocalShell?.(sessionId, shellType, xtermInstance.current.cols, xtermInstance.current.rows);
        setConnected(true);
      } else {
        xtermInstance.current.writeln(`\r\n\x1b[38;5;39m[DgodTerm]\x1b[0m Reconnecting to ${profile.hostname}...`);
        (window as any).dgodterm.connectSSH(sessionId, profile.id, xtermInstance.current.cols, xtermInstance.current.rows);
        setConnected(true);
      }
    }
  };

  const handleDisconnect = () => {
    const isLocalShell = profile.id.startsWith('local-');
    if (isLocalShell) {
      (window as any).dgodterm?.closeLocalShell?.(sessionId);
    } else {
      (window as any).dgodterm.disconnectSSH(sessionId);
    }
    setConnected(false);
  };

  const handlePasswordSubmit = async (pass: string) => {
    setShowPasswordModal(false);
    let ttl = -1;
    try {
      const saved = localStorage.getItem('dgodterm_session_settings');
      if (saved) ttl = JSON.parse(saved).passwordRetentionMinutes ?? -1;
    } catch (e) {}
    await (window as any).dgodterm.submitTransientPassword(sessionId, pass, ttl, profile.id);
    if (xtermInstance.current) {
      xtermInstance.current.writeln(`\r\n\x1b[38;5;39m[DgodTerm]\x1b[0m Submitting password authentication...`);
    }
  };

  const confirmPaste = () => {
    if (pendingPasteText && xtermInstance.current) {
      if (profile.id.startsWith('local-')) {
        (window as any).dgodterm?.sendLocalData?.(sessionId, pendingPasteText);
      } else {
        (window as any).dgodterm.sendSSHData(sessionId, pendingPasteText);
      }
      setPendingPasteText(null);
      xtermInstance.current.focus();
    }
  };

  const handleMenuCopy = async () => {
    if (xtermInstance.current?.hasSelection()) {
      const text = xtermInstance.current.getSelection();
      if (text) {
        const ok = await copyTextToClipboard(text);
        if (ok) {
          xtermInstance.current.clearSelection();
          showToast('Copied to clipboard');
        }
      }
    }
    setTerminalContextMenu(null);
  };

  const handleMenuPaste = async () => {
    setTerminalContextMenu(null);
    const text = await readTextFromClipboard();
    if (!text) {
      showToast('Clipboard is empty');
      return;
    }
    if (text.includes('\n') || text.includes('\r')) {
      setPendingPasteText(text);
    } else {
      if (profile.id.startsWith('local-')) {
        (window as any).dgodterm?.sendLocalData?.(sessionId, text);
      } else {
        (window as any).dgodterm.sendSSHData(sessionId, text);
      }
    }
  };

  const handleMenuSelectAll = () => {
    xtermInstance.current?.selectAll();
    setTerminalContextMenu(null);
  };

  const handleMenuClear = () => {
    xtermInstance.current?.clear();
    setTerminalContextMenu(null);
  };

  const isTransparent = currentThemeBg.startsWith('rgba') || currentThemeBg === 'transparent';

  return (
    <div className="flex flex-col h-full w-full transition-colors duration-200 bg-transparent">
      {/* Session Host Identity Banner */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <DistroIcon flavor={currentProfile.os_flavor} className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-white font-semibold">{currentProfile.display_name}</span>
            <span className="text-slate-500 font-mono">({currentProfile.username}@{currentProfile.hostname}:{currentProfile.port})</span>
            {currentProfile.os_name && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 font-sans">
                {currentProfile.os_name}
              </span>
            )}
          </div>

          {/* Production Visual Safeguard Badge */}
          {((profile.tags || []).some((t) => /prod/i.test(t)) || /prod/i.test(profile.display_name)) && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/80 border border-red-500/60 text-red-200 text-[10px] font-bold uppercase tracking-wider animate-pulse shadow-sm shadow-red-950/50">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>PRODUCTION HOST</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-800 border border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                connected
                  ? 'bg-emerald-400 animate-pulse'
                  : isAutoReconnecting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-red-400'
              }`}
            />
            <span
              className={
                connected
                  ? 'text-emerald-300 font-medium'
                  : isAutoReconnecting
                  ? 'text-amber-300 font-semibold'
                  : 'text-red-300'
              }
            >
              {connected
                ? 'CONNECTED'
                : isAutoReconnecting
                ? `RECONNECTING (${reconnectAttempt}/5)...`
                : 'DISCONNECTED'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Strict Identity Verified</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Heartbeat: {profile.ssh_options?.keepalive_interval ?? 15}s</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Enter Password Button */}
          <button
            onClick={() => {
              if (onRequestPassword) {
                onRequestPassword(sessionId, profile);
              } else {
                setPasswordPromptText(`Enter password for ${profile.username}@${profile.hostname}:`);
                setShowPasswordModal(true);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/40 text-sky-200 text-xs font-semibold shadow-sm transition"
            title="Authenticate / Enter Password"
          >
            <KeyRound className="w-3.5 h-3.5 text-sky-300" />
            <span>Enter Password</span>
          </button>

          {/* Active Recording Pill Indicator */}
          {isRecording && (
            <button
              onClick={toggleRecording}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-950/90 border border-rose-500/80 text-rose-300 text-xs font-semibold animate-pulse shadow-sm shadow-rose-950/50 cursor-pointer"
              title="Stop Recording Session"
            >
              <Video className="w-3.5 h-3.5 text-rose-400" />
              <span>REC</span>
            </button>
          )}

          {/* Unified Host Tools Dropdown Menu */}
          <div className="relative shrink-0" ref={toolsDropdownRef}>
            <button
              onClick={() => setShowToolsDropdown(!showToolsDropdown)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold shadow-sm transition cursor-pointer ${
                showToolsDropdown || showHealthMonitor || isRecording || showAICopilot
                  ? 'bg-sky-950/90 border-sky-500/70 text-sky-200 shadow-sky-950/50'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title="Host Diagnostics, Telemetry, Audits & Viewport Multiplexing"
            >
              <Wrench className="w-3.5 h-3.5 text-sky-400" />
              <span>Host Tools</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showToolsDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 z-50 animate-in fade-in zoom-in-95 duration-100">
                {/* Telemetry & System Inspector */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Diagnostics & System</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">LIVE</span>
                </div>

                <button
                  onClick={() => {
                    setShowHealthMonitor(!showHealthMonitor);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    <span>System Health Telemetry</span>
                  </div>
                  {showHealthMonitor && <span className="text-[10px] text-emerald-400 font-mono font-bold">ON</span>}
                </button>

                <button
                  onClick={() => {
                    setShowProcessModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  <span>Process Manager & Signals</span>
                </button>

                <button
                  onClick={() => {
                    setShowSystemdModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Linux Systemd Services</span>
                </button>

                <button
                  onClick={() => {
                    setShowNetworkPortsModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Listening Ports & Sockets</span>
                </button>

                <button
                  onClick={() => {
                    setShowDockerModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <Boxes className="w-3.5 h-3.5 text-sky-400" />
                  <span>Docker Containers</span>
                </button>

                <div className="h-px bg-slate-800 my-1" />

                {/* Security & Intelligence */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Security & Intelligence</span>
                </div>

                <button
                  onClick={() => {
                    setShowSecurityAuditModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CIS Benchmark Security Audit</span>
                </button>

                <button
                  onClick={() => {
                    setShowAICopilot(!showAICopilot);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>AI Command Copilot</span>
                  </div>
                  {showAICopilot && <span className="text-[10px] text-amber-400 font-mono font-bold">OPEN</span>}
                </button>

                <button
                  onClick={() => {
                    setShowNotesModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Host Notes & Insights</span>
                  </div>
                  {currentProfile.notes?.trim() && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Notes present" />
                  )}
                </button>

                <div className="h-px bg-slate-800 my-1" />

                {/* Session & Viewport Multiplexing */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Session & Viewport</span>
                </div>

                <button
                  onClick={() => {
                    setShowSnippetsModal(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5 text-sky-400" />
                  <span>Quick Snippets Palette</span>
                </button>

                <button
                  onClick={() => {
                    toggleRecording();
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isRecording ? 'Stop Recording' : 'Record Session (asciicast)'}</span>
                  </div>
                  {isRecording && <span className="text-[10px] text-rose-400 animate-pulse font-mono">REC</span>}
                </button>

                {splitMode === 'none' ? (
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-slate-300">Split Viewport</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          startSplit('vertical');
                          setShowToolsDropdown(false);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition"
                        title="Split Vertically (Columns)"
                      >
                        <Columns className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Side-by-side</span>
                      </button>
                      <button
                        onClick={() => {
                          startSplit('horizontal');
                          setShowToolsDropdown(false);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition"
                        title="Split Horizontally (Rows)"
                      >
                        <Rows className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Stacked</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      closeSplit();
                      setShowToolsDropdown(false);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-950/60 text-rose-300 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Close Split Pane</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dedicated Close Split Button when active */}
          {splitMode !== 'none' && (
            <button
              onClick={closeSplit}
              className="flex items-center gap-1 px-2 py-1 rounded bg-rose-950/60 border border-rose-500/50 text-rose-300 hover:bg-rose-900/60 text-xs font-medium transition cursor-pointer"
              title="Close Split Terminal Pane"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Split</span>
            </button>
          )}

          {showSearch ? (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded px-2 py-0.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Find in terminal..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none w-36"
                autoFocus
              />
              <button onClick={() => setShowSearch(false)} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              title="Search (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleReconnect}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            title="Reconnect"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDisconnect}
            className="p-1 rounded hover:bg-slate-800 text-red-400 hover:text-red-300"
            title="Disconnect"
          >
            <PowerOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Remote System Health Monitor Widget */}
      {showHealthMonitor && (
        <HealthMonitorWidget
          sessionId={sessionId}
          hostname={profile.hostname}
          isExpanded={expandProcesses}
          onToggleExpand={() => setExpandProcesses(!expandProcesses)}
        />
      )}

      {/* Terminal Viewport / Multiplexer Panes */}
      <div className={`flex-1 w-full overflow-hidden flex ${splitMode === 'horizontal' ? 'flex-col' : 'flex-row'}`}>
        {/* Primary Pane */}
        <div
          className={`relative flex-1 h-full overflow-hidden transition-all duration-200 cursor-text ${
            splitMode !== 'none'
              ? activePane === 'primary'
                ? 'border-2 border-sky-500/70 shadow-inner'
                : 'border border-slate-800 opacity-90'
              : ''
          }`}
          style={{
            padding: `${paddingPx}px`,
            backgroundColor: currentThemeBg,
            backdropFilter: isTransparent ? 'blur(16px)' : undefined,
            WebkitBackdropFilter: isTransparent ? 'blur(16px)' : undefined
          }}
          onClick={() => setActivePane('primary')}
        >
          {splitMode !== 'none' && (
            <div className="absolute top-1 right-2 z-10 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-slate-300 font-mono flex items-center gap-1.5 pointer-events-none select-none">
              <span className={`w-1.5 h-1.5 rounded-full ${activePane === 'primary' ? 'bg-sky-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>Pane 1 {activePane === 'primary' ? '(Active)' : ''}</span>
            </div>
          )}
          <div ref={terminalRef} className="w-full h-full" />
        </div>

        {/* Secondary Split Pane */}
        {splitMode !== 'none' && (
          <div
            className={`relative flex-1 h-full overflow-hidden transition-all duration-200 cursor-text ${
              splitMode === 'vertical' ? 'border-l border-slate-700/80' : 'border-t border-slate-700/80'
            } ${
              activePane === 'secondary'
                ? 'border-2 border-sky-500/70 shadow-inner'
                : 'border border-slate-800 opacity-90'
            }`}
            style={{
              padding: `${paddingPx}px`,
              backgroundColor: currentThemeBg,
              backdropFilter: isTransparent ? 'blur(16px)' : undefined,
              WebkitBackdropFilter: isTransparent ? 'blur(16px)' : undefined
            }}
            onClick={() => setActivePane('secondary')}
          >
            <div className="absolute top-1 right-2 z-10 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-slate-300 font-mono flex items-center gap-1.5 select-none">
              <span className={`w-1.5 h-1.5 rounded-full ${activePane === 'secondary' ? 'bg-sky-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>Pane 2 {activePane === 'secondary' ? '(Active)' : ''}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSplit();
                }}
                className="ml-1 text-slate-400 hover:text-red-400 p-0.5 cursor-pointer"
                title="Close split pane"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div ref={secondaryTerminalRef} className="w-full h-full" />
          </div>
        )}
      </div>

      {/* Right-Click Context Menu for Terminal */}
      {terminalContextMenu && (
        <div
          className="fixed inset-0 z-50 select-none"
          onClick={() => setTerminalContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setTerminalContextMenu(null);
          }}
        >
          <div
            style={{
              top: `${Math.min(terminalContextMenu.y, window.innerHeight - 280)}px`,
              left: `${Math.min(terminalContextMenu.x, window.innerWidth - 240)}px`
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute min-w-[210px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 z-50 animate-in fade-in duration-100"
          >
            {/* Header info */}
            <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between gap-2">
              <span className="truncate max-w-[140px] font-semibold text-slate-200">
                {profile.display_name}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                TERMINAL
              </span>
            </div>

            {/* Copy */}
            <button
              onClick={handleMenuCopy}
              disabled={!terminalContextMenu.hasSelection}
              className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition text-sky-300 font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Copy</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Ctrl+Shift+C</span>
            </button>

            {/* Paste */}
            <button
              onClick={handleMenuPaste}
              className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 hover:text-white transition text-emerald-300 font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                <span>Paste</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Ctrl+Shift+V</span>
            </button>

            <div className="h-px bg-slate-800/80 my-1" />

            {/* Select All */}
            <button
              onClick={handleMenuSelectAll}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition text-slate-300 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Select All</span>
            </button>

            {/* Clear Screen */}
            <button
              onClick={handleMenuClear}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition text-slate-300 cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Buffer & Screen</span>
            </button>

            {/* Find in terminal */}
            <button
              onClick={() => {
                setShowSearch(true);
                setTerminalContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-800 hover:text-white transition text-slate-300 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Find in Terminal...</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Ctrl+F</span>
            </button>

            <div className="h-px bg-slate-800/80 my-1" />

            {/* Reconnect */}
            <button
              onClick={() => {
                handleReconnect();
                setTerminalContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition text-slate-300 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reconnect</span>
            </button>

            {/* Enter Password */}
            <button
              onClick={() => {
                setTerminalContextMenu(null);
                if (onRequestPassword) {
                  onRequestPassword(sessionId, profile);
                } else {
                  setPasswordPromptText(`Enter password for ${profile.username}@${profile.hostname}:`);
                  setShowPasswordModal(true);
                }
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition text-sky-400 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-sky-400" />
              <span>Enter Password...</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating feedback toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-sky-500/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* In-Terminal Password Modal */}
      {showPasswordModal && (
        <PasswordPromptModal
          profile={profile}
          promptText={passwordPromptText}
          onSubmit={handlePasswordSubmit}
          onCancel={() => setShowPasswordModal(false)}
        />
      )}

      {/* Catastrophic Destructive Command Interceptor Modal */}
      {pendingDestructiveAlert && (
        <DestructiveCommandModal
          alert={pendingDestructiveAlert.alert}
          profile={profile}
          commandText={pendingDestructiveAlert.command}
          onConfirm={() => {
            const cmd = pendingDestructiveAlert.command;
            setPendingDestructiveAlert(null);
            (window as any).dgodterm.sendSSHData(sessionId, cmd);
            showToast('Warning: Destructive command authorized');
          }}
          onCancel={() => {
            setPendingDestructiveAlert(null);
            showToast('Destructive command aborted');
          }}
        />
      )}

      {/* Multi-line Paste Modal Interceptor */}
      {pendingPasteText && (
        <ClipboardPasteModal
          content={pendingPasteText}
          onConfirm={confirmPaste}
          onCancel={() => setPendingPasteText(null)}
        />
      )}

      {/* Snippets Palette Modal */}
      {showSnippetsModal && (
        <SnippetsModal
          onClose={() => setShowSnippetsModal(false)}
          onExecuteSnippet={handleInsertSnippet}
        />
      )}

      {/* Session Recording Playback & Export Modal */}
      {completedRecording && (
        <SessionRecorderModal
          recording={completedRecording}
          onClose={() => setCompletedRecording(null)}
        />
      )}

      {/* Linux Systemd Services Modal */}
      {showSystemdModal && (
        <SystemdServicesModal
          target={modalTarget}
          onClose={() => setShowSystemdModal(false)}
        />
      )}

      {/* Listening Network Ports & Socket Inspector Modal */}
      {showNetworkPortsModal && (
        <NetworkPortsModal
          target={modalTarget}
          onClose={() => setShowNetworkPortsModal(false)}
        />
      )}

      {/* CIS Benchmark & Security Hardening Audit Modal */}
      {showSecurityAuditModal && (
        <SecurityAuditModal
          target={modalTarget}
          onClose={() => setShowSecurityAuditModal(false)}
        />
      )}

      {/* Docker & Podman Container Inspector Modal */}
      {showDockerModal && (
        <DockerInspectorModal
          target={activeModalTarget}
          onClose={() => setShowDockerModal(false)}
          onOpenShell={(cmd) => {
            const targetSession = getTargetSessionId();
            (window as any).dgodterm?.sendSSHData?.(targetSession, cmd + '\n');
            showToast('Docker exec shell started');
          }}
        />
      )}

      {/* Remote Host Top Process Manager Modal */}
      {showProcessModal && (
        <ProcessManagerModal
          target={activeModalTarget}
          onClose={() => setShowProcessModal(false)}
        />
      )}

      {/* AI Command Copilot Drawer */}
      {showAICopilot && (
        <AICopilotPanel
          onClose={() => setShowAICopilot(false)}
          context={{ hostname: profile.hostname, username: profile.username }}
          onInsertCommand={(cmd, run) => {
            const targetSession = getTargetSessionId();
            const isLocal = profile.id.startsWith('local-');
            if (run) {
              if (isLocal) {
                (window as any).dgodterm?.sendLocalData?.(targetSession, cmd + '\n');
              } else {
                (window as any).dgodterm?.sendSSHData?.(targetSession, cmd + '\n');
              }
              showToast('Command executed in terminal');
            } else {
              if (isLocal) {
                (window as any).dgodterm?.sendLocalData?.(targetSession, cmd);
              } else {
                (window as any).dgodterm?.sendSSHData?.(targetSession, cmd);
              }
              showToast('Command inserted into terminal');
            }
          }}
        />
      )}

      {/* Host Operational Notes & Insights Modal */}
      {showNotesModal && (
        <HostNotesModal
          profile={currentProfile}
          folders={[]}
          onSave={async (updated) => {
            await (window as any).dgodterm?.saveProfile?.(updated);
            setCurrentProfile(updated);
          }}
          onClose={() => setShowNotesModal(false)}
        />
      )}
    </div>
  );
};
