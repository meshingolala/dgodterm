import React, { useState, useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Shield,
  LifeBuoy,
  Cpu,
  FileCheck2,
  CheckCircle2,
  Download,
  Eye,
  X,
  Server,
  Clock,
  Lock,
  Timer,
  Zap,
  Terminal,
  Palette,
  Sliders,
  Type,
  Maximize2,
  Sparkles,
  MousePointer,
  RotateCcw,
  Undo2,
  Check,
  ChevronRight,
  ChevronDown,
  Monitor,
  Layout,
  Volume2,
  VolumeX,
  Copy,
  Sun,
  Moon,
  Smartphone,
  QrCode,
  AlertTriangle,
  KeyRound,
  Plus,
  Minus,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { QrCanvas } from './QrCanvas';
import { CustomSelect, CustomSelectOption } from './CustomSelect';
import {
  TerminalSettings,
  GeneralUiSettings,
  SessionSecuritySettings,
  TERMINAL_THEMES,
  APP_THEME_PRESETS,
  DEFAULT_TERMINAL_SETTINGS,
  DEFAULT_GENERAL_UI_SETTINGS,
  DEFAULT_SESSION_SECURITY_SETTINGS,
  getTerminalSettings,
  saveTerminalSettings,
  getGeneralUiSettings,
  saveGeneralUiSettings,
  getSessionSecuritySettings,
  saveSessionSecuritySettings
} from '../settings/settings-manager';

const SCREEN_LOCK_OPTIONS: CustomSelectOption<number>[] = [
  { value: 5, label: '5 minutes (Aggressive)', description: 'Locks screen quickly after 5 minutes of inactivity.' },
  { value: 15, label: '15 minutes (Standard)', description: 'Balanced security for shared desks or office.' },
  { value: 30, label: '30 minutes (Default)', description: 'Standard timeout for typical workstation workflows.' },
  { value: 60, label: '1 hour', description: 'Permits longer uninterrupted reading or long-running tasks.' },
  { value: 120, label: '2 hours', description: 'Extended timeout for prolonged monitoring.' },
  { value: 480, label: '8 hours (Full Work Day)', description: 'Keeps unlocked throughout standard shift.' },
  { value: 0, label: 'Disabled (Never Lock)', description: 'No automatic idle lock (Caution in shared environments).' },
];

const RETENTION_OPTIONS: CustomSelectOption<number>[] = [
  { value: -1, label: 'Keep for Entire Session (Until App Closes)', description: 'Credentials kept in volatile RAM until app exits.' },
  { value: 15, label: '15 minutes', description: 'Flushes cached password after 15 minutes.' },
  { value: 30, label: '30 minutes', description: 'Flushes cached password after 30 minutes.' },
  { value: 60, label: '1 hour', description: 'Flushes cached password after 1 hour.' },
  { value: 240, label: '4 hours', description: 'Flushes cached password after 4 hours.' },
  { value: 0, label: 'Never Cache (Prompt Every Time)', description: 'Requires authentication every time connection opens.' },
];

const FONT_FAMILY_OPTIONS: CustomSelectOption<string>[] = [
  { value: "'Consolas', monospace", label: 'Consolas', description: 'Classic clean Windows system monospace' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono', description: 'Engineered for developers with increased letter height' },
  { value: "'Fira Code', 'Courier New', monospace", label: 'Fira Code', description: 'Modern monospace with programming ligatures' },
  { value: "'Cascadia Code', 'Cascadia Mono', monospace", label: 'Cascadia Code', description: 'Modern Microsoft terminal monospace font' },
  { value: "'IBM Plex Mono', monospace", label: 'IBM Plex Mono', description: "IBM's corporate open-source monospace, high legibility" },
  { value: "'Source Code Pro', monospace", label: 'Source Code Pro', description: "Adobe's crisp open-source developer font" },
  { value: "'Space Mono', monospace", label: 'Space Mono', description: 'Geometric, retro-futuristic monospace by Colophon' },
  { value: "'Inconsolata', monospace", label: 'Inconsolata', description: 'Beloved humanist monospace designed by Raph Levien' },
  { value: "'Roboto Mono', monospace", label: 'Roboto Mono', description: "Google's geometric monospace with clean proportions" },
  { value: "'Ubuntu Mono', monospace", label: 'Ubuntu Mono', description: 'Distinctive rounded Linux developer monospace' },
  { value: "'Courier New', monospace", label: 'Courier New', description: 'Typewriter traditional fixed-width font' },
  { value: "'Lucida Console', monospace", label: 'Lucida Console', description: 'Classic wide Windows monospace' },
  { value: "'Menlo', monospace", label: 'Menlo', description: 'Apple macOS standard developer font' },
  { value: "'Monaco', monospace", label: 'Monaco', description: 'Compact retro macOS monospace' },
  { value: "ui-monospace, monospace", label: 'System Monospace', description: 'Native operating system monospace' },
];

const FONT_WEIGHT_OPTIONS: CustomSelectOption<'normal' | '500' | '600' | 'bold'>[] = [
  { value: 'normal', label: 'Regular (400)', description: 'Standard stroke weight' },
  { value: '500', label: 'Medium (500)', description: 'Crisper strokes for high-DPI displays' },
  { value: '600', label: 'Semi-Bold (600)', description: 'Higher contrast text emphasis' },
  { value: 'bold', label: 'Bold (700)', description: 'Maximum stroke thickness and visibility' },
];

const LINE_HEIGHT_OPTIONS: CustomSelectOption<number>[] = [
  { value: 1.0, label: '1.0 (Compact)', description: 'Tightest vertical spacing for high density' },
  { value: 1.15, label: '1.15 (Balanced)', description: 'Slightly condensed line spacing' },
  { value: 1.25, label: '1.25 (Default)', description: 'Optimal standard line separation' },
  { value: 1.35, label: '1.35 (Relaxed)', description: 'Generous line spacing' },
  { value: 1.5, label: '1.5 (Spacious)', description: 'Maximum vertical breathing room' },
];

const SCROLLBACK_OPTIONS: CustomSelectOption<number>[] = [
  { value: 1000, label: '1,000 lines', description: 'Minimal RAM footprint' },
  { value: 3000, label: '3,000 lines', description: 'Standard buffer size' },
  { value: 5000, label: '5,000 lines (Default)', description: 'Recommended for standard SSH sessions' },
  { value: 10000, label: '10,000 lines', description: 'Generous history for build outputs and log tailing' },
  { value: 20000, label: '20,000 lines', description: 'Massive buffer for heavy sysadmin tasks' },
];

const PADDING_OPTIONS: CustomSelectOption<number>[] = [
  { value: 4, label: '4px (Edge-to-Edge)', description: 'Maximum terminal viewport real estate' },
  { value: 8, label: '8px (Default)', description: 'Clean comfortable terminal bezel' },
  { value: 12, label: '12px (Balanced)', description: 'Distinguished outer padding' },
  { value: 16, label: '16px (Spacious)', description: 'Modern framed aesthetic' },
  { value: 20, label: '20px (Luxury)', description: 'Generous padded perimeter' },
];

const DENSITY_OPTIONS: CustomSelectOption<'compact' | 'comfortable' | 'spacious'>[] = [
  { value: 'compact', label: 'Compact', description: 'Tighter spacing, smaller margins, highest data density' },
  { value: 'comfortable', label: 'Comfortable (Default)', description: 'Balanced spacing and standard touch targets' },
  { value: 'spacious', label: 'Spacious', description: 'Generous margins and large clickable items' },
];

const TAB_STYLE_OPTIONS: CustomSelectOption<'rounded' | 'modern' | 'minimal'>[] = [
  { value: 'rounded', label: 'Rounded Top Tabs (Default)', description: 'Classic top tab bar with colored accent top border' },
  { value: 'modern', label: 'Modern Floating Cards', description: 'Contained card tabs with subtle borders' },
  { value: 'minimal', label: 'Minimal Underline', description: 'Flat borderless tabs with active underline' },
];

const SIDEBAR_WIDTH_OPTIONS: CustomSelectOption<number>[] = [
  { value: 220, label: '220px (Compact)', description: 'Slim sidebar saving horizontal screen space' },
  { value: 260, label: '260px (Default)', description: 'Standard balanced navigation pane' },
  { value: 300, label: '300px (Wide)', description: 'Extra room for long hostnames and tags' },
];

const ACCENT_COLOR_OPTIONS: { id: GeneralUiSettings['accentColor']; name: string; hex: string; bgClass: string; ringClass: string }[] = [
  { id: 'sky', name: 'Sky Blue (Default)', hex: '#38bdf8', bgClass: 'bg-sky-500', ringClass: 'ring-sky-400' },
  { id: 'indigo', name: 'Indigo / Violet', hex: '#6366f1', bgClass: 'bg-indigo-500', ringClass: 'ring-indigo-400' },
  { id: 'emerald', name: 'Emerald Green', hex: '#10b981', bgClass: 'bg-emerald-500', ringClass: 'ring-emerald-400' },
  { id: 'rose', name: 'Rose / Crimson', hex: '#f43f5e', bgClass: 'bg-rose-500', ringClass: 'ring-rose-400' },
  { id: 'amber', name: 'Amber Gold', hex: '#f59e0b', bgClass: 'bg-amber-500', ringClass: 'ring-amber-400' },
  { id: 'cyan', name: 'Cyber Cyan', hex: '#06b6d4', bgClass: 'bg-cyan-500', ringClass: 'ring-cyan-400' },
];

const APP_FONT_OPTIONS: CustomSelectOption<string>[] = [
  { value: "'Google Sans', 'Plus Jakarta Sans', 'Segoe UI Variable Text', 'Inter', system-ui, -apple-system, sans-serif", label: 'Google Sans', description: 'Antigravity signature geometric sans-serif' },
  { value: "'Inter', system-ui, -apple-system, sans-serif", label: 'Inter', description: 'Clean modern enterprise sans-serif' },
  { value: "'Plus Jakarta Sans', system-ui, sans-serif", label: 'Plus Jakarta Sans', description: 'Contemporary geometric sans with warm curve details' },
  { value: "'Outfit', system-ui, sans-serif", label: 'Outfit', description: 'Modern geometric display sans with rounded friendly aesthetics' },
  { value: "'Roboto', system-ui, sans-serif", label: 'Roboto', description: 'Google standard clean versatile sans-serif' },
  { value: "'Segoe UI', system-ui, sans-serif", label: 'Segoe UI', description: 'Native Windows fluent typography' },
  { value: "'Fira Code', monospace", label: 'Fira Code', description: 'Full monospace UI presentation' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono', description: 'Developer-oriented monospace typography' },
  { value: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", label: 'System Native UI', description: 'Default OS desktop interface font' },
];

const APP_FONT_SIZE_OPTIONS: CustomSelectOption<number>[] = [
  { value: 11, label: '11px (Tiny / Ultra-compact)', description: 'Highest data display density' },
  { value: 12, label: '12px (Compact)', description: 'Condenses panels and toolbars' },
  { value: 13, label: '13px (Default)', description: 'Balanced standard readable size' },
  { value: 14, label: '14px (Medium)', description: 'Enhanced readability on standard monitors' },
  { value: 15, label: '15px (Large)', description: 'Comfortable presentation on high-resolution screens' },
  { value: 16, label: '16px (Extra Large)', description: 'Maximum visual accessibility' },
];

const ANTIALIASING_OPTIONS: CustomSelectOption<'antialiased' | 'subpixel' | 'none' | 'ultra'>[] = [
  { value: 'subpixel', label: 'Subpixel ClearType (Recommended for Windows)', description: 'Hardens edge contrast and aligns glyphs to RGB LCD subpixel grid' },
  { value: 'ultra', label: 'Ultra-Sharp (Micro-Contour & Edge Hardening)', description: 'Maximum razor-sharp glyph definition tuned for dark backgrounds' },
  { value: 'none', label: 'None (Pixel Crisp / Geometric Precision)', description: 'Zero smoothing, pure vector geometry with blur layer filtering disabled' },
  { value: 'antialiased', label: 'Grayscale Antialiased (Natural / Soft)', description: 'Soft grayscale antialiasing for high-DPI Retina/OLED displays' },
];

const FONT_STROKE_WEIGHT_OPTIONS: CustomSelectOption<'normal' | 'medium' | 'strong'>[] = [
  { value: 'medium', label: 'Medium Crisp (500) - Recommended for Dark Mode', description: 'Compensates for dark-background optical erosion, making glyphs sharp and solid' },
  { value: 'normal', label: 'Normal (400 Regular)', description: 'Standard slender glyph stroke weight' },
  { value: 'strong', label: 'Semi-Bold Solid (600)', description: 'High-contrast heavy stroke weight for maximum visibility' },
];

const CURSOR_COLORS = [
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Emerald', hex: '#34d399' },
  { name: 'Amber Gold', hex: '#fbbf24' },
  { name: 'Coral Red', hex: '#f87171' },
  { name: 'Violet', hex: '#a78bfa' },
  { name: 'Pure White', hex: '#ffffff' },
];

interface TerminalLivePreviewProps {
  terminalSettings: TerminalSettings;
  activeThemeObj: (typeof TERMINAL_THEMES)[string];
  onReset: () => void;
}

const TerminalLivePreview: React.FC<TerminalLivePreviewProps> = ({
  terminalSettings,
  activeThemeObj,
  onReset,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lineBufferRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current) return;

    // Synchronize CSS custom property across DOM and container
    document.documentElement.style.setProperty('--dgod-terminal-font', terminalSettings.fontFamily);
    containerRef.current.style.setProperty('--dgod-terminal-font', terminalSettings.fontFamily);

    const term = new XTerm({
      allowTransparency: false,
      cursorBlink: terminalSettings.cursorBlink,
      cursorStyle: terminalSettings.cursorStyle,
      fontFamily: terminalSettings.fontFamily,
      fontSize: terminalSettings.fontSize,
      lineHeight: terminalSettings.lineHeight,
      fontWeight: terminalSettings.fontWeight as any,
      scrollback: 500,
      rows: 8,
      theme: {
        ...activeThemeObj,
        cursor: terminalSettings.cursorColor || activeThemeObj.cursor,
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    }, 25);

    // Initial realistic shell simulation content
    term.writeln(`\x1b[36mdgod@prod-gateway\x1b[0m:\x1b[34m~\x1b[0m$ uname -srm`);
    term.writeln(`\x1b[90mLinux 6.8.0-45-generic x86_64\x1b[0m`);
    term.writeln(`\x1b[36mdgod@prod-gateway\x1b[0m:\x1b[34m~\x1b[0m$ ./fleet-verify.sh --cluster production`);
    term.writeln(`\x1b[32m[✓] 16/16 Target Nodes Verified\x1b[0m \x1b[90m—\x1b[0m \x1b[33mAudit Chain Active\x1b[0m`);
    term.writeln(`\x1b[35m[INF] Host Key Enforcement:\x1b[0m \x1b[36mSTRICT (Ed25519)\x1b[0m`);
    term.write(`\x1b[36mdgod@prod-gateway\x1b[0m:\x1b[34m~\x1b[0m$ `);

    // Interactive command handling
    const onDataDisposable = term.onData((data) => {
      if (data === '\r') {
        const cmd = lineBufferRef.current.trim();
        lineBufferRef.current = '';
        term.write('\r\n');

        if (cmd === 'uptime') {
          term.writeln(` 09:43:00 up 142 days, 18:22,  2 users,  load average: 0.12, 0.08, 0.05`);
        } else if (cmd === 'uname' || cmd.startsWith('uname ')) {
          term.writeln(`Linux prod-gateway 6.8.0-45-generic x86_64 GNU/Linux`);
        } else if (cmd === 'whoami') {
          term.writeln(`dgod (SecOps Lead / Superuser)`);
        } else if (cmd === 'ls' || cmd.startsWith('ls ')) {
          term.writeln(`\x1b[1;32mfleet-verify.sh\x1b[0m  \x1b[1;34mansible-playbooks/\x1b[0m  inventory.ini  \x1b[33mid_ed25519\x1b[0m`);
        } else if (cmd === 'font') {
          term.writeln(`Active Font: ${terminalSettings.fontFamily} (${terminalSettings.fontSize}px)`);
        } else if (cmd === 'date') {
          term.writeln(new Date().toUTCString());
        } else if (cmd === 'clear') {
          term.clear();
        } else if (cmd === 'help') {
          term.writeln(`Interactive Preview Shell. Commands: uptime, uname, whoami, ls, font, date, clear, echo, help`);
        } else if (cmd.startsWith('echo ')) {
          term.writeln(cmd.slice(5));
        } else if (cmd.length > 0) {
          term.writeln(`bash: ${cmd.split(' ')[0]}: command not found`);
        }

        term.write(`\x1b[36mdgod@prod-gateway\x1b[0m:\x1b[34m~\x1b[0m$ `);
      } else if (data === '\x7f' || data === '\b') {
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data === '\x03') {
        term.write('^C\r\n');
        lineBufferRef.current = '';
        term.write(`\x1b[36mdgod@prod-gateway\x1b[0m:\x1b[34m~\x1b[0m$ `);
      } else if (data === '\x0c') {
        term.clear();
        term.write(`\x1b[36mdgod@prod-gateway\x1b[0m:\x1b[34m~\x1b[0m$ ${lineBufferRef.current}`);
      } else if (data >= ' ') {
        lineBufferRef.current += data;
        term.write(data);
      }
    });

    const ro = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      onDataDisposable.dispose();
      try {
        term.dispose();
      } catch (e) {}
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Dynamically update XTerm options and CSS properties on state changes
  useEffect(() => {
    if (!xtermRef.current || !containerRef.current) return;
    const term = xtermRef.current;

    document.documentElement.style.setProperty('--dgod-terminal-font', terminalSettings.fontFamily);
    containerRef.current.style.setProperty('--dgod-terminal-font', terminalSettings.fontFamily);

    term.options.fontFamily = terminalSettings.fontFamily;
    term.options.fontSize = terminalSettings.fontSize;
    term.options.lineHeight = terminalSettings.lineHeight;
    term.options.fontWeight = terminalSettings.fontWeight as any;
    term.options.cursorStyle = terminalSettings.cursorStyle;
    term.options.cursorBlink = terminalSettings.cursorBlink;
    term.options.theme = {
      ...activeThemeObj,
      cursor: terminalSettings.cursorColor || activeThemeObj.cursor,
    };

    if (fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
      } catch (e) {}
    }
    try {
      (term as any).refresh?.(0, term.rows - 1);
    } catch (e) {}
  }, [terminalSettings, activeThemeObj]);

  return (
    <div className="bg-slate-900/90 border border-sky-500/40 rounded-xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Live Terminal Preview
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            ({activeThemeObj.name} • {terminalSettings.fontSize}px • {terminalSettings.fontFamily.split(',')[0].replace(/'/g, '')})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            Reset Terminal Defaults
          </button>
        </div>
      </div>

      <div
        className="rounded-lg border border-slate-700/80 shadow-2xl overflow-hidden transition-all duration-200 cursor-text"
        onClick={() => xtermRef.current?.focus()}
        style={{
          backgroundColor: activeThemeObj.background,
          padding: `${terminalSettings.windowPadding}px`,
        }}
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 opacity-70 text-[11px] select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            <span className="ml-2 font-mono text-[10px] text-slate-300">dgod@enterprise-fleet-01:~</span>
          </div>
          <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 font-mono">
            Interactive Shell — Type commands & test fonts
          </span>
        </div>

        <div
          ref={containerRef}
          className="w-full h-44 overflow-hidden"
          style={{
            fontFamily: terminalSettings.fontFamily,
          }}
        />
      </div>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  // Navigation Section Tab
  const [activeTab, setActiveTab] = useState<'terminal' | 'ui' | 'session' | 'policy'>('ui');

  // Terminal Settings
  const [terminalSettings, setTerminalSettings] = useState<TerminalSettings>(getTerminalSettings);

  // General UI Settings
  const [uiSettings, setUiSettings] = useState<GeneralUiSettings>(getGeneralUiSettings);

  // Policy & Agent Diagnostics
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const [supportBundle, setSupportBundle] = useState<any>(null);
  const [generatingBundle, setGeneratingBundle] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);

  // Session & Screen Timeout Settings
  const [autoLockoutEnabled, setAutoLockoutEnabled] = useState(true);
  const [screenLockTimeoutMinutes, setScreenLockTimeoutMinutes] = useState(15);
  const [customTimeoutInput, setCustomTimeoutInput] = useState('15');
  const [lockOnOsLock, setLockOnOsLock] = useState(true);

  useEffect(() => {
    const handleSwitch = (e: any) => {
      if (e.detail && ['terminal', 'ui', 'session', 'policy'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('dgodterm:switch-settings-tab', handleSwitch);
    return () => window.removeEventListener('dgodterm:switch-settings-tab', handleSwitch);
  }, []);
  const [passwordRetentionMinutes, setPasswordRetentionMinutes] = useState(-1);
  const [keepTabsAliveInBackground, setKeepTabsAliveInBackground] = useState(true);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Google Authenticator MFA States
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaSetupModal, setShowMfaSetupModal] = useState(false);
  const [showMfaDisableModal, setShowMfaDisableModal] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [copiedMfaSecret, setCopiedMfaSecret] = useState(false);

  // MobaXterm X11 Display Server States
  const [x11Status, setX11Status] = useState<{ isRunning: boolean; port: number; display: string; detectedServers: any[] } | null>(null);
  const [isCheckingX11, setIsCheckingX11] = useState(false);
  const [x11Message, setX11Message] = useState('');

  const checkX11Status = async () => {
    setIsCheckingX11(true);
    try {
      const status = await (window as any).dgodterm?.getX11Status?.();
      if (status) setX11Status(status);
    } catch {}
    finally {
      setIsCheckingX11(false);
    }
  };

  const handleLaunchX11 = async () => {
    setX11Message('Launching X11 server...');
    try {
      const res = await (window as any).dgodterm?.launchX11Server?.();
      setX11Message(res?.message || 'X11 Server launched');
      await checkX11Status();
    } catch (e: any) {
      setX11Message(e.message || 'Failed to launch X11 server');
    }
  };

  useEffect(() => {
    loadPolicyAndAgent();
    loadMfaStatus();
    checkX11Status();
    try {
      const sessionSec = getSessionSecuritySettings();
      setAutoLockoutEnabled(sessionSec.autoLockoutEnabled);
      setScreenLockTimeoutMinutes(sessionSec.screenLockTimeoutMinutes);
      setCustomTimeoutInput(String(sessionSec.screenLockTimeoutMinutes));
      setLockOnOsLock(sessionSec.lockOnOsLock);
      setPasswordRetentionMinutes(sessionSec.passwordRetentionMinutes);
      setKeepTabsAliveInBackground(sessionSec.keepTabsAliveInBackground);
    } catch (e) {}
  }, []);

  const loadMfaStatus = async () => {
    try {
      const status = await (window as any).dgodterm.getMfaStatus?.();
      if (status) {
        setMfaEnabled(Boolean(status.isEnabled));
      }
    } catch (e) {}
  };

  const handleStartMfaSetup = async () => {
    setMfaError('');
    setMfaSuccess('');
    setMfaVerifyCode('');
    try {
      const data = await (window as any).dgodterm.setupMfa();
      setMfaSetupData(data);
      setShowMfaSetupModal(true);
    } catch (err: any) {
      setMfaError(err.message || 'Failed to initialize MFA.');
    }
  };

  const handleConfirmMfaEnable = async () => {
    if (!mfaSetupData || !mfaVerifyCode) {
      setMfaError('Please enter the 6-digit code from Google Authenticator.');
      return;
    }
    try {
      const res = await (window as any).dgodterm.enableMfa(mfaSetupData.secret, mfaVerifyCode);
      if (res.success) {
        setMfaEnabled(true);
        setShowMfaSetupModal(false);
        setMfaSuccess('Google Authenticator successfully activated!');
        setTimeout(() => setMfaSuccess(''), 4000);
      } else {
        setMfaError(res.error || 'Failed to verify authenticator code.');
      }
    } catch (err: any) {
      setMfaError(err.message || 'Verification failed');
    }
  };

  const handleDisableMfa = async () => {
    if (!mfaDisablePassword) {
      setMfaError('Workstation password is required to disable MFA.');
      return;
    }
    try {
      const res = await (window as any).dgodterm.disableMfa(mfaDisablePassword);
      if (res.success) {
        setMfaEnabled(false);
        setShowMfaDisableModal(false);
        setMfaDisablePassword('');
        setMfaSuccess('Two-factor authentication disabled.');
        setTimeout(() => setMfaSuccess(''), 4000);
      } else {
        setMfaError(res.error || 'Incorrect password.');
      }
    } catch (err: any) {
      setMfaError(err.message || 'Failed to disable MFA.');
    }
  };

  const loadPolicyAndAgent = async () => {
    try {
      const pol = await (window as any).dgodterm.getActivePolicy();
      setActivePolicy(pol);

      const agent = await (window as any).dgodterm.detectSshAgent();
      setAgentInfo(agent);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTerminalSetting = <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => {
    const updated = { ...terminalSettings, [key]: value };
    setTerminalSettings(updated);
    saveTerminalSettings(updated);
    if (key === 'fontFamily') {
      document.documentElement.style.setProperty('--dgod-terminal-font', value as string);
    }
    showSavedNotification();
  };

  const handleUpdateUiSetting = <K extends keyof GeneralUiSettings>(key: K, value: GeneralUiSettings[K]) => {
    const updated = { ...uiSettings, [key]: value };
    setUiSettings(updated);
    saveGeneralUiSettings(updated);
    showSavedNotification();
  };

  const handleSelectThemePreset = (presetId: string) => {
    const preset = APP_THEME_PRESETS[presetId];
    if (!preset) return;
    const updated: GeneralUiSettings = {
      ...uiSettings,
      themePreset: preset.id,
      themeMode: preset.mode,
      appTheme: preset.mode === 'light' ? 'light' : 'windows11',
      customBackground: preset.background,
      customForeground: preset.foreground,
      customAccent: preset.accent
    };
    setUiSettings(updated);
    saveGeneralUiSettings(updated);
    if (preset.terminalThemeId && TERMINAL_THEMES[preset.terminalThemeId]) {
      const nextTerm = {
        ...terminalSettings,
        themeId: preset.terminalThemeId,
        cursorColor: preset.accent
      };
      setTerminalSettings(nextTerm);
      saveTerminalSettings(nextTerm);
    }
    showSavedNotification();
  };

  const handleResetThemePreset = () => {
    const currentPresetId = uiSettings.themePreset || 'gruvbox-material';
    handleSelectThemePreset(currentPresetId);
  };

  const handleThemeModeChange = (mode: 'system' | 'light' | 'dark') => {
    const isLight =
      mode === 'light' ||
      (mode === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches);
    const currentPreset = APP_THEME_PRESETS[uiSettings.themePreset || 'gruvbox-material'];
    let nextPreset = currentPreset;
    if (isLight && currentPreset?.mode === 'dark') {
      nextPreset = APP_THEME_PRESETS['gruvbox-light'];
    } else if (!isLight && currentPreset?.mode === 'light') {
      nextPreset = APP_THEME_PRESETS['gruvbox-material'];
    }
    const updated: GeneralUiSettings = {
      ...uiSettings,
      themeMode: mode,
      appTheme: isLight ? 'light' : 'windows11',
      ...(nextPreset && nextPreset.id !== currentPreset?.id
        ? {
            themePreset: nextPreset.id,
            customBackground: nextPreset.background,
            customForeground: nextPreset.foreground,
            customAccent: nextPreset.accent
          }
        : {})
    };
    setUiSettings(updated);
    saveGeneralUiSettings(updated);
    if (nextPreset?.terminalThemeId && TERMINAL_THEMES[nextPreset.terminalThemeId]) {
      const nextTerm = {
        ...terminalSettings,
        themeId: nextPreset.terminalThemeId,
        cursorColor: nextPreset.accent
      };
      setTerminalSettings(nextTerm);
      saveTerminalSettings(nextTerm);
    }
    showSavedNotification();
  };

  const handleSaveSessionSettings = (updated: Partial<SessionSecuritySettings>) => {
    const current = getSessionSecuritySettings();
    const next: SessionSecuritySettings = {
      ...current,
      autoLockoutEnabled: updated.autoLockoutEnabled !== undefined ? updated.autoLockoutEnabled : autoLockoutEnabled,
      screenLockTimeoutMinutes: updated.screenLockTimeoutMinutes !== undefined ? updated.screenLockTimeoutMinutes : screenLockTimeoutMinutes,
      passwordRetentionMinutes: updated.passwordRetentionMinutes !== undefined ? updated.passwordRetentionMinutes : passwordRetentionMinutes,
      keepTabsAliveInBackground: updated.keepTabsAliveInBackground !== undefined ? updated.keepTabsAliveInBackground : keepTabsAliveInBackground,
      lockOnOsLock: updated.lockOnOsLock !== undefined ? updated.lockOnOsLock : lockOnOsLock,
    };
    setAutoLockoutEnabled(next.autoLockoutEnabled);
    setScreenLockTimeoutMinutes(next.screenLockTimeoutMinutes);
    setCustomTimeoutInput(String(next.screenLockTimeoutMinutes));
    setLockOnOsLock(next.lockOnOsLock);
    setPasswordRetentionMinutes(next.passwordRetentionMinutes);
    setKeepTabsAliveInBackground(next.keepTabsAliveInBackground);

    saveSessionSecuritySettings(next);
    showSavedNotification();
  };

  const handleCustomTimeoutChange = (valStr: string) => {
    setCustomTimeoutInput(valStr);
    const num = parseInt(valStr, 10);
    if (!isNaN(num) && num >= 1 && num <= 1440) {
      handleSaveSessionSettings({ screenLockTimeoutMinutes: num });
    }
  };

  const handleCustomTimeoutStep = (delta: number) => {
    const current = screenLockTimeoutMinutes || 15;
    const nextVal = Math.max(1, Math.min(1440, current + delta));
    setCustomTimeoutInput(String(nextVal));
    handleSaveSessionSettings({ screenLockTimeoutMinutes: nextVal });
  };

  const handleTriggerManualLock = () => {
    window.dispatchEvent(new Event('dgodterm:lock-request'));
  };

  const handleResetTerminalDefaults = () => {
    setTerminalSettings(DEFAULT_TERMINAL_SETTINGS);
    saveTerminalSettings(DEFAULT_TERMINAL_SETTINGS);
    document.documentElement.style.setProperty('--dgod-terminal-font', DEFAULT_TERMINAL_SETTINGS.fontFamily);
    showSavedNotification();
  };

  const handleResetUiDefaults = () => {
    setUiSettings(DEFAULT_GENERAL_UI_SETTINGS);
    saveGeneralUiSettings(DEFAULT_GENERAL_UI_SETTINGS);
    showSavedNotification();
  };

  const showSavedNotification = () => {
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleGenerateBundle = async () => {
    setGeneratingBundle(true);
    try {
      // First try comprehensive diagnostics report, fallback to support bundle
      let bundle;
      if ((window as any).dgodterm.generateDiagnosticsReport) {
        bundle = await (window as any).dgodterm.generateDiagnosticsReport();
      } else {
        bundle = await (window as any).dgodterm.generateSupportBundle();
      }
      setSupportBundle(bundle);
      setShowBundleModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingBundle(false);
    }
  };

  const handleDownloadBundle = () => {
    if (!supportBundle) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(supportBundle, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `dgodterm-support-bundle-${Date.now()}.json`);
    a.click();
  };

  const activeThemeObj = TERMINAL_THEMES[terminalSettings.themeId] || TERMINAL_THEMES['dgod-dark'];

  return (
    <div className="flex flex-col h-full w-full bg-[#090d16] text-slate-200 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-6 pb-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/40">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Preferences & System Settings
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize terminal rendering, user interface layout, governance policies, and session security.
              </p>
            </div>
          </div>
        </div>

        {/* Saved Status Indicator */}
        <div className="flex items-center gap-3">
          {savedFeedback && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-in fade-in zoom-in-95 duration-150">
              <Check className="w-3.5 h-3.5" />
              Settings Saved Live
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tabs Pill Bar */}
      <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ui')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
            activeTab === 'ui'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Appearance</span>
        </button>

        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
            activeTab === 'terminal'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Terminal Emulator</span>
        </button>

        <button
          onClick={() => setActiveTab('session')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
            activeTab === 'session'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Timer className="w-3.5 h-3.5" />
          <span>Session & Screen Timeout</span>
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
            activeTab === 'policy'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Governance & Diagnostics</span>
        </button>
      </div>

      {/* Main Tab Content Viewport */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ======================================================== */}
        {/* TAB 1: TERMINAL APPEARANCE                               */}
        {/* ======================================================== */}
        {activeTab === 'terminal' && (
          <div className="space-y-6">
            {/* Live Interactive Terminal Preview */}
            <TerminalLivePreview
              terminalSettings={terminalSettings}
              activeThemeObj={activeThemeObj}
              onReset={handleResetTerminalDefaults}
            />

            {/* Terminal Typography & Font Settings */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Type className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Typography & Font Metrics
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Font Family */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Font Family</label>
                  <CustomSelect
                    value={terminalSettings.fontFamily}
                    onChange={(val) => handleUpdateTerminalSetting('fontFamily', String(val))}
                    options={FONT_FAMILY_OPTIONS}
                  />
                </div>

                {/* Font Weight */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Font Weight</label>
                  <CustomSelect
                    value={terminalSettings.fontWeight}
                    onChange={(val) => handleUpdateTerminalSetting('fontWeight', val as any)}
                    options={FONT_WEIGHT_OPTIONS}
                  />
                </div>

                {/* Font Size */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-400 font-medium">Font Size</label>
                    <span className="text-xs font-mono font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      {terminalSettings.fontSize}px
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={22}
                      step={1}
                      value={terminalSettings.fontSize}
                      onChange={(e) => handleUpdateTerminalSetting('fontSize', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[11, 12, 13, 14, 16].map((size) => (
                        <button
                          key={size}
                          onClick={() => handleUpdateTerminalSetting('fontSize', size)}
                          className={`px-2 py-1 rounded text-[11px] font-mono transition ${
                            terminalSettings.fontSize === size
                              ? 'bg-sky-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Line Height */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Line Spacing / Height</label>
                  <CustomSelect
                    value={terminalSettings.lineHeight}
                    onChange={(val) => handleUpdateTerminalSetting('lineHeight', Number(val))}
                    options={LINE_HEIGHT_OPTIONS}
                  />
                </div>
              </div>

              {/* Live Terminal Typography Preview Strip */}
              <div
                className="mt-3 p-4 rounded-xl border border-slate-800/90 bg-black/90 flex flex-col gap-2.5 transition-all shadow-inner"
                style={{
                  fontFamily: terminalSettings.fontFamily,
                  fontSize: `${terminalSettings.fontSize}px`,
                  lineHeight: terminalSettings.lineHeight,
                  fontWeight: terminalSettings.fontWeight === 'bold' ? 700 : (terminalSettings.fontWeight === '600' ? 600 : (terminalSettings.fontWeight === '500' ? 500 : 400))
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] font-sans text-slate-400">
                  <span className="font-semibold text-sky-400">Live Terminal Typography Preview</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {terminalSettings.fontFamily.replace(/['"]/g, '')} • {terminalSettings.fontSize}px
                  </span>
                </div>
                <div style={{ fontFamily: terminalSettings.fontFamily }} className="text-emerald-400 whitespace-nowrap overflow-hidden text-ellipsis">
                  user@dgodterm:~$ echo "Active Font Family: ${terminalSettings.fontFamily.replace(/['"]/g, '')}"
                </div>
                <div style={{ fontFamily: terminalSettings.fontFamily }} className="text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis">
                  0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz ()[]{}!@#$%^&*-+=
                </div>
              </div>
            </div>

            {/* Terminal Color Schemes & Themes */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Terminal Color Themes
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {Object.keys(TERMINAL_THEMES).length} Hand-Crafted Themes Available
                </span>
              </div>

              {/* Theme Grid Cards */}
              <div className="grid grid-cols-2 gap-3">
                {Object.values(TERMINAL_THEMES).map((theme) => {
                  const isSelected = terminalSettings.themeId === theme.id;
                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleUpdateTerminalSetting('themeId', theme.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'border-sky-500 bg-sky-950/20 shadow-lg ring-1 ring-sky-500/50'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
                            style={{ backgroundColor: theme.cursor }}
                          />
                          <span className="text-xs font-bold text-white">{theme.name}</span>
                        </div>
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 uppercase">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mb-2.5 line-clamp-1">
                        {theme.description}
                      </p>

                      {/* Swatch preview bar */}
                      <div className="relative rounded-lg border border-white/10 overflow-hidden">
                        <div
                          className="relative p-2 flex items-center justify-between"
                          style={{
                            backgroundColor: theme.background
                          }}
                        >
                          <span className="text-[10px] font-mono px-1 font-bold" style={{ color: theme.foreground }}>
                            ABC
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: theme.red }} />
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: theme.green }} />
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: theme.yellow }} />
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: theme.blue }} />
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: theme.magenta }} />
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: theme.cyan }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cursor & Viewport Behavior */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <MousePointer className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Cursor & Buffer Dynamics
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-5">
                {/* Cursor Style */}
                <div>
                  <label className="text-xs text-slate-400 block mb-2 font-medium">Cursor Shape</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'block', label: 'Block', icon: '█' },
                      { id: 'underline', label: 'Underline', icon: ' ' },
                      { id: 'bar', label: 'Bar', icon: '|' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleUpdateTerminalSetting('cursorStyle', c.id as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition ${
                          terminalSettings.cursorStyle === c.id
                            ? 'bg-sky-600/20 border-sky-500 text-sky-200 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="font-mono text-sm">{c.icon}</span>
                        <span className="text-[10px] mt-1">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cursor Blinking */}
                <div>
                  <label className="text-xs text-slate-400 block mb-2 font-medium">Cursor Animation</label>
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-xs text-slate-200 font-medium">Blinking Cursor</span>
                    <input
                      type="checkbox"
                      checked={terminalSettings.cursorBlink}
                      onChange={(e) => handleUpdateTerminalSetting('cursorBlink', e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Cursor Color */}
                <div>
                  <label className="text-xs text-slate-400 block mb-2 font-medium">Cursor Color</label>
                  <div className="flex items-center gap-1.5">
                    {CURSOR_COLORS.map((cc) => (
                      <button
                        key={cc.hex}
                        onClick={() => handleUpdateTerminalSetting('cursorColor', cc.hex)}
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          terminalSettings.cursorColor === cc.hex
                            ? 'scale-125 border-white ring-2 ring-sky-500 shadow-md'
                            : 'border-white/20 hover:scale-110'
                        }`}
                        style={{ backgroundColor: cc.hex }}
                        title={cc.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Scrollback buffer */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Scrollback History Buffer</label>
                  <CustomSelect
                    value={terminalSettings.scrollback}
                    onChange={(val) => handleUpdateTerminalSetting('scrollback', Number(val))}
                    options={SCROLLBACK_OPTIONS}
                  />
                </div>

                {/* Viewport Padding */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Window Padding</label>
                  <CustomSelect
                    value={terminalSettings.windowPadding}
                    onChange={(val) => handleUpdateTerminalSetting('windowPadding', Number(val))}
                    options={PADDING_OPTIONS}
                  />
                </div>

                {/* Copy on select & Right click paste */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 block font-medium">Terminal Mouse Behavior</label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={terminalSettings.copyOnSelect}
                      onChange={(e) => handleUpdateTerminalSetting('copyOnSelect', e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Copy to clipboard on text selection</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={terminalSettings.rightClickPaste}
                      onChange={(e) => handleUpdateTerminalSetting('rightClickPaste', e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Right-click copy & paste (Copies selection if text selected, Pastes if unselected; Hold Shift for context menu)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: GENERAL USER INTERFACE                            */}
        {/* ======================================================== */}
        {activeTab === 'ui' && (
          <div className="max-w-4xl space-y-7 pb-6">
            {/* ======================================================== */}
            {/* ANTIGRAVITY APPEARANCE & THEME ENGINE                    */}
            {/* ======================================================== */}
            <div className="space-y-6">
              <div>
                <h2 className="text-[22px] font-medium tracking-tight" style={{ color: 'var(--dgod-text-primary)' }}>
                  Appearance
                </h2>
                <p className="text-[13.5px] mt-1" style={{ color: 'var(--dgod-text-secondary)' }}>
                  Configure the agent&apos;s visual theme and display preferences.
                </p>
              </div>

              {/* Section 1: Chat / Conversation Steps */}
              <div>
                <div className="agy-section-title">Chat</div>
                <div className="agy-card">
                  <div className="agy-row">
                    <div>
                      <div className="agy-row-label">Conversation Steps</div>
                      <div className="agy-row-sublabel">
                        Choose how much detail is shown during a conversation and session activity log.
                      </div>
                    </div>
                    <div className="agy-pill-group">
                      <button
                        type="button"
                        onClick={() => handleUpdateUiSetting('conversationSteps', 'default')}
                        className={`agy-pill-btn ${(uiSettings.conversationSteps || 'default') === 'default' ? 'active' : ''}`}
                      >
                        Default
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateUiSetting('conversationSteps', 'verbose')}
                        className={`agy-pill-btn ${uiSettings.conversationSteps === 'verbose' ? 'active' : ''}`}
                      >
                        Verbose
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Appearance (Theme, Contrast, Font) */}
              <div>
                <div className="agy-section-title">Appearance</div>
                <div className="agy-card">
                  {/* Row 1: Theme (System | Light | Dark) */}
                  <div className="agy-row">
                    <div className="agy-row-label">Theme</div>
                    <div className="agy-pill-group">
                      <button
                        type="button"
                        title="System Theme"
                        onClick={() => handleThemeModeChange('system')}
                        className={`agy-pill-btn !px-3.5 ${uiSettings.themeMode === 'system' ? 'active' : ''}`}
                      >
                        <Monitor className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Light Theme"
                        onClick={() => handleThemeModeChange('light')}
                        className={`agy-pill-btn !px-3.5 ${uiSettings.themeMode === 'light' ? 'active' : ''}`}
                      >
                        <Sun className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Dark Theme"
                        onClick={() => handleThemeModeChange('dark')}
                        className={`agy-pill-btn !px-3.5 ${(uiSettings.themeMode || 'dark') === 'dark' ? 'active' : ''}`}
                      >
                        <Moon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Contrast (Default | Strong) */}
                  <div className="agy-row">
                    <div className="agy-row-label">Contrast</div>
                    <div className="agy-pill-group">
                      <button
                        type="button"
                        onClick={() => handleUpdateUiSetting('contrast', 'default')}
                        className={`agy-pill-btn ${uiSettings.contrast === 'default' ? 'active' : ''}`}
                      >
                        Default
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateUiSetting('contrast', 'strong')}
                        className={`agy-pill-btn ${(uiSettings.contrast || 'strong') === 'strong' ? 'active' : ''}`}
                      >
                        Strong
                      </button>
                    </div>
                  </div>

                  {/* Row 3: Font */}
                  <div className="agy-row">
                    <div className="agy-row-label">Font</div>
                    <div className="relative inline-flex items-center">
                      <select
                        value={uiSettings.appFontFamily || APP_FONT_OPTIONS[0].value}
                        onChange={(e) => handleUpdateUiSetting('appFontFamily', e.target.value)}
                        className="agy-select-pill"
                      >
                        {APP_FONT_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="w-3.5 h-3.5 pointer-events-none absolute right-3.5"
                        style={{ color: 'var(--dgod-text-secondary)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Dark Theme / Light Theme Customization Card */}
              <div>
                <div className="agy-section-title">
                  {uiSettings.themeMode === 'light' ? 'Light Theme' : 'Dark Theme'}
                </div>
                <div className="agy-card">
                  {/* Row 1: Preset */}
                  <div className="agy-row">
                    <div className="agy-row-label">Preset</div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleResetThemePreset}
                        title="Reset colors to preset defaults"
                        className="p-1.5 rounded-full hover:bg-white/5 transition cursor-pointer"
                        style={{ color: 'var(--dgod-text-secondary)' }}
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                      <div className="relative inline-flex items-center">
                        <select
                          value={uiSettings.themePreset || 'gruvbox-material'}
                          onChange={(e) => handleSelectThemePreset(e.target.value)}
                          className="agy-select-pill"
                        >
                          {Object.values(APP_THEME_PRESETS).map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="w-3.5 h-3.5 pointer-events-none absolute right-3.5"
                          style={{ color: 'var(--dgod-text-secondary)' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Background */}
                  <div className="agy-row">
                    <div className="agy-row-label">Background</div>
                    <label className="agy-color-pill">
                      <span
                        className="w-4 h-4 rounded-[4px] border border-white/15 shrink-0 relative overflow-hidden"
                        style={{ backgroundColor: uiSettings.customBackground || '#2D2F30' }}
                      >
                        <input
                          type="color"
                          value={uiSettings.customBackground || '#2D2F30'}
                          onChange={(e) => handleUpdateUiSetting('customBackground', e.target.value.toUpperCase())}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--dgod-text-secondary)' }}>#</span>
                      <input
                        type="text"
                        maxLength={7}
                        value={(uiSettings.customBackground || '#2D2F30').replace('#', '')}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                          handleUpdateUiSetting('customBackground', `#${raw}`);
                        }}
                        className="w-[62px] bg-transparent font-mono text-[13px] focus:outline-none uppercase"
                        style={{ color: 'var(--dgod-text-primary)' }}
                      />
                    </label>
                  </div>

                  {/* Row 3: Foreground */}
                  <div className="agy-row">
                    <div className="agy-row-label">Foreground</div>
                    <label className="agy-color-pill">
                      <span
                        className="w-4 h-4 rounded-[4px] border border-white/15 shrink-0 relative overflow-hidden"
                        style={{ backgroundColor: uiSettings.customForeground || '#D4BE98' }}
                      >
                        <input
                          type="color"
                          value={uiSettings.customForeground || '#D4BE98'}
                          onChange={(e) => handleUpdateUiSetting('customForeground', e.target.value.toUpperCase())}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--dgod-text-secondary)' }}>#</span>
                      <input
                        type="text"
                        maxLength={7}
                        value={(uiSettings.customForeground || '#D4BE98').replace('#', '')}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                          handleUpdateUiSetting('customForeground', `#${raw}`);
                        }}
                        className="w-[62px] bg-transparent font-mono text-[13px] focus:outline-none uppercase"
                        style={{ color: 'var(--dgod-text-primary)' }}
                      />
                    </label>
                  </div>

                  {/* Row 4: Accent */}
                  <div className="agy-row">
                    <div className="agy-row-label">Accent</div>
                    <label className="agy-color-pill">
                      <span
                        className="w-4 h-4 rounded-[4px] border border-white/15 shrink-0 relative overflow-hidden"
                        style={{ backgroundColor: uiSettings.customAccent || '#E78A4E' }}
                      >
                        <input
                          type="color"
                          value={uiSettings.customAccent || '#E78A4E'}
                          onChange={(e) => handleUpdateUiSetting('customAccent', e.target.value.toUpperCase())}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--dgod-text-secondary)' }}>#</span>
                      <input
                        type="text"
                        maxLength={7}
                        value={(uiSettings.customAccent || '#E78A4E').replace('#', '')}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                          handleUpdateUiSetting('customAccent', `#${raw}`);
                        }}
                        className="w-[62px] bg-transparent font-mono text-[13px] focus:outline-none uppercase"
                        style={{ color: 'var(--dgod-text-primary)' }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Layout Density & Navigation Options */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Layout className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Layout Density & Workspace Framing
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-5">
                {/* Density */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Interface Density</label>
                  <CustomSelect
                    value={uiSettings.uiDensity}
                    onChange={(val) => handleUpdateUiSetting('uiDensity', val as any)}
                    options={DENSITY_OPTIONS}
                  />
                </div>

                {/* Sidebar Width */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Left Navigation Sidebar Width</label>
                  <CustomSelect
                    value={uiSettings.sidebarWidth}
                    onChange={(val) => handleUpdateUiSetting('sidebarWidth', Number(val))}
                    options={SIDEBAR_WIDTH_OPTIONS}
                  />
                </div>

                {/* Tab Style */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Tab Bar Presentation</label>
                  <CustomSelect
                    value={uiSettings.tabStyle}
                    onChange={(val) => handleUpdateUiSetting('tabStyle', val as any)}
                    options={TAB_STYLE_OPTIONS}
                  />
                </div>
              </div>
            </div>

            {/* Application Typography & Antialiasing */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Type className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Application Typography & Font Rendering
                </h3>
              </div>

              <p className="text-xs text-slate-400">
                Configure global font typeface, UI base font size, and text antialiasing / smoothing mode applied throughout the desktop and web workstation interface.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Font Selection */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Application Font Family</label>
                  <CustomSelect
                    value={uiSettings.appFontFamily || "'Inter', system-ui, -apple-system, sans-serif"}
                    onChange={(val) => handleUpdateUiSetting('appFontFamily', String(val))}
                    options={APP_FONT_OPTIONS}
                  />
                </div>

                {/* Font Size */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Base UI Font Size</label>
                  <CustomSelect
                    value={uiSettings.appFontSize || 13}
                    onChange={(val) => handleUpdateUiSetting('appFontSize', Number(val))}
                    options={APP_FONT_SIZE_OPTIONS}
                  />
                </div>

                {/* Font Antialiasing / Clarity Mode */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Font Clarity & Antialiasing</label>
                  <CustomSelect
                    value={uiSettings.fontAntialiasing || 'subpixel'}
                    onChange={(val) => handleUpdateUiSetting('fontAntialiasing', val as any)}
                    options={ANTIALIASING_OPTIONS}
                  />
                </div>

                {/* Glyph Stroke Weight & Density */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Stroke Weight & Density</label>
                  <CustomSelect
                    value={uiSettings.fontStrokeWeight || 'medium'}
                    onChange={(val) => handleUpdateUiSetting('fontStrokeWeight', val as any)}
                    options={FONT_STROKE_WEIGHT_OPTIONS}
                  />
                </div>
              </div>

              {/* Live Typography Preview Strip */}
              <div
                className={`mt-3 p-4 rounded-xl border border-slate-800 bg-slate-950/80 flex flex-col gap-2.5 clarity-${uiSettings.fontAntialiasing || 'subpixel'} stroke-${uiSettings.fontStrokeWeight || 'medium'}`}
                style={{
                  fontFamily: uiSettings.appFontFamily || "'Inter', system-ui, sans-serif",
                  fontSize: `${uiSettings.appFontSize || 13}px`
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-300">
                    Live Typography Rendering Preview
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                      {uiSettings.appFontSize || 13}px
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
                      {uiSettings.fontAntialiasing || 'subpixel'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                      {uiSettings.fontStrokeWeight || 'medium'} stroke
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">
                    The quick brown fox jumps over the lazy dog &bull; 0123456789
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    User Interface Labels, Session Tabs, Host Names &bull; High-contrast crisp rendering on dark backgrounds
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono pt-1">
                    root@production-cluster-01:~$ ./ansible-playbook -i inventory.ini deploy.yml --diff
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 leading-relaxed">
                  <strong className="text-slate-400">Windows DirectWrite Notice:</strong> WebKit vendor smoothing is superseded by DirectWrite on Windows. DgodTerm's Clarity Engine utilizes optical irradiation compensation, RGB subpixel alignment, and edge contour hardening to ensure razor-sharp legibility.
                </div>
              </div>
            </div>

            {/* Visual Performance & Behavior */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Visual FX & Workspace Safety
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Glassmorphic Backdrop Blur */}
                <label className="flex items-start justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                  <div className="pr-3">
                    <span className="text-xs text-slate-200 font-semibold block">Glassmorphism & Backdrop Blur</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                      Enable translucent frosted-glass panels. Disable for reduced GPU resource consumption.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uiSettings.enableBlur}
                    onChange={(e) => handleUpdateUiSetting('enableBlur', e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0 mt-0.5 cursor-pointer"
                  />
                </label>

                {/* Smooth Animations */}
                <label className="flex items-start justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                  <div className="pr-3">
                    <span className="text-xs text-slate-200 font-semibold block">Smooth UI Animations</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                      Enable gentle transitions and modal scaling. Disable for instant zero-latency rendering.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uiSettings.enableAnimations}
                    onChange={(e) => handleUpdateUiSetting('enableAnimations', e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0 mt-0.5 cursor-pointer"
                  />
                </label>

                {/* Show Bottom Status Bar */}
                <label className="flex items-start justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                  <div className="pr-3">
                    <span className="text-xs text-slate-200 font-semibold block">Show Security Status Footer</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                      Display bottom bar showing ISO/IEC compliance, audit chain status, and secret redactor state.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uiSettings.showStatusBar}
                    onChange={(e) => handleUpdateUiSetting('showStatusBar', e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0 mt-0.5 cursor-pointer"
                  />
                </label>

                {/* Confirm on Close Active Session */}
                <label className="flex items-start justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                  <div className="pr-3">
                    <span className="text-xs text-slate-200 font-semibold block">Safety Confirmation on Tab Close</span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                      Guard against accidental disconnection by requesting confirmation when closing active SSH tabs.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uiSettings.confirmCloseSession}
                    onChange={(e) => handleUpdateUiSetting('confirmCloseSession', e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0 mt-0.5 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* MobaXterm X11 Forwarding & Display Server Manager */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    X11 Display Server &amp; Linux GUI Forwarding
                  </h3>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-500/40 font-bold">
                    MobaXterm Mode
                  </span>
                </div>
                <button
                  onClick={checkX11Status}
                  disabled={isCheckingX11}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 text-purple-400 ${isCheckingX11 ? 'animate-spin' : ''}`} />
                  <span>Check Status</span>
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Like MobaXterm, DgodTerm supports integrated SSH X11 channel forwarding. When X11 forwarding is enabled on a Linux host profile, remote graphical applications (e.g. <code className="text-purple-300 font-mono text-[11px]">xeyes</code>, <code className="text-purple-300 font-mono text-[11px]">gedit</code>, <code className="text-purple-300 font-mono text-[11px]">virt-manager</code>, <code className="text-purple-300 font-mono text-[11px]">wireshark</code>) automatically project as floating native windows on your Windows desktop via <code className="text-purple-300 font-mono text-[11px]">127.0.0.1:6000 (:0.0)</code>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Live Status Card */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Local X11 Server Status</span>
                    {x11Status?.isRunning ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>ACTIVE (PORT 6000)</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>STANDBY / STOPPED</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Target Display: <strong className="text-slate-200 font-mono">127.0.0.1:0.0</strong>
                  </div>
                  {!x11Status?.isRunning && (
                    <button
                      onClick={handleLaunchX11}
                      className="mt-2 w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Launch Local X11 Server</span>
                    </button>
                  )}
                  {x11Message && (
                    <div className="text-[11px] text-purple-300 font-mono mt-1 pt-1 border-t border-slate-800">
                      {x11Message}
                    </div>
                  )}
                </div>

                {/* Detected Engines Card */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block">Detected Local X Servers</span>
                  <div className="space-y-1 text-xs">
                    {(x11Status?.detectedServers || []).length > 0 ? (
                      x11Status?.detectedServers.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">{s.name}</span>
                          {s.exists ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Installed</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">Not detected</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        Compatible with VcXsrv, Xming, Cygwin/X, and X410 Windows X servers.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: SESSION & SCREEN TIMEOUT                          */}
        {/* ======================================================== */}
        {activeTab === 'session' && (
          <div className="space-y-6">
            {/* Automatic Inactivity Lockout Hero Card */}
            <div className="bg-slate-900/90 border border-sky-500/40 rounded-xl p-5 space-y-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-bold text-white">
                        Automatic Workstation Inactivity Lockout
                      </h3>
                      {autoLockoutEnabled ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Active &bull; {screenLockTimeoutMinutes} min
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                      Automatically locks down your terminal workstation when you step away from your desk or leave the app idle.
                      Once locked, active SSH sessions are masked and protected behind your Master Password and Google Authenticator.
                    </p>
                  </div>
                </div>

                {/* Master Toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={autoLockoutEnabled}
                    onChange={(e) => handleSaveSessionSettings({ autoLockoutEnabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    {autoLockoutEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              {autoLockoutEnabled ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-4">
                  {/* Custom Number Input & Stepper */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-850">
                    <div>
                      <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sky-400" />
                        Configure Lockout Timeout Duration
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Set any exact number of minutes you want before the workstation automatically locks.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="flex items-center bg-slate-900 border border-slate-750 rounded-lg overflow-hidden shadow-inner">
                        <button
                          type="button"
                          onClick={() => handleCustomTimeoutStep(-1)}
                          disabled={screenLockTimeoutMinutes <= 1}
                          title="Decrease by 1 minute"
                          className="px-2.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={customTimeoutInput}
                          onChange={(e) => handleCustomTimeoutChange(e.target.value)}
                          onBlur={() => setCustomTimeoutInput(String(screenLockTimeoutMinutes))}
                          className="w-16 bg-transparent text-center font-mono font-bold text-sm text-sky-300 focus:outline-none py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => handleCustomTimeoutStep(1)}
                          disabled={screenLockTimeoutMinutes >= 1440}
                          title="Increase by 1 minute"
                          className="px-2.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs font-medium text-slate-400">minutes</span>
                    </div>
                  </div>

                  {/* Quick Preset Pills */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Quick Presets:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { mins: 1, label: '1 min (Test)' },
                        { mins: 2, label: '2 mins' },
                        { mins: 5, label: '5 mins' },
                        { mins: 10, label: '10 mins' },
                        { mins: 15, label: '15 mins (Standard)' },
                        { mins: 30, label: '30 mins (Default)' },
                        { mins: 60, label: '1 hour' },
                        { mins: 120, label: '2 hours' }
                      ].map((preset) => {
                        const isSelected = screenLockTimeoutMinutes === preset.mins;
                        return (
                          <button
                            key={preset.mins}
                            type="button"
                            onClick={() => {
                              setCustomTimeoutInput(String(preset.mins));
                              handleSaveSessionSettings({ screenLockTimeoutMinutes: preset.mins });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                              isSelected
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/20'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* OS Lock Screen Sync & Manual Lock Button */}
                  <div className="pt-3 border-t border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lockOnOsLock}
                        onChange={(e) => handleSaveSessionSettings({ lockOnOsLock: e.target.checked })}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300">
                        Lock immediately when Windows lock screen is triggered (<kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono text-slate-300">Win+L</kbd>) or system sleeps
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleTriggerManualLock}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition-colors self-start sm:self-auto"
                      title="Test lock screen immediately"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      Test Lock Screen Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Workstation inactivity lockout is currently disabled. DgodTerm will remain unlocked even when away from your desk.
                  </span>
                </div>
              )}
            </div>

            {/* Additional Session & Memory Security Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Password Retention */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3 shadow-lg">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  Password In-Memory Retention
                </label>
                <p className="text-[11px] text-slate-400">
                  Controls how long SSH passwords are held in volatile RAM so you do not need to re-type credentials on reconnect.
                </p>
                <CustomSelect
                  value={passwordRetentionMinutes}
                  onChange={(val) => handleSaveSessionSettings({ passwordRetentionMinutes: Number(val) })}
                  options={RETENTION_OPTIONS}
                />
              </div>

              {/* Background Keep-Alive */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3 shadow-lg flex flex-col justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Background Session Keep-Alive
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Maintain live SSH socket streams while switching between tabs or working in settings.
                  </p>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={keepTabsAliveInBackground}
                    onChange={(e) => handleSaveSessionSettings({ keepTabsAliveInBackground: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-medium">Keep sessions connected in background</span>
                </label>
              </div>
            </div>

              {/* Google Authenticator (MFA / 2FA) Workstation Access Card */}
              <div className="mt-4 p-5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Google Authenticator (MFA / 2FA) Workstation Security
                        {mfaEnabled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ACTIVE & ENFORCED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                            DISABLED
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Protects your terminal workspace with a dynamic 6-digit Time-Based One-Time Password (TOTP) from Google Authenticator or any RFC 6238 mobile app.
                      </p>
                    </div>
                  </div>

                  <div>
                    {mfaEnabled ? (
                      <button
                        onClick={() => { setMfaError(''); setShowMfaDisableModal(true); }}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
                      >
                        Disable Google MFA
                      </button>
                    ) : (
                      <button
                        onClick={handleStartMfaSetup}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        Configure Google MFA
                      </button>
                    )}
                  </div>
                </div>

                {mfaSuccess && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{mfaSuccess}</span>
                  </div>
                )}
              </div>
            </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: GOVERNANCE & DIAGNOSTICS                          */}
        {/* ======================================================== */}
        {activeTab === 'policy' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Active Policy Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Active Governance Policy
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ENFORCING
                  </span>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Policy Identifier:</span>
                    <span className="text-sky-400">{activePolicy?.policy_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Host Key Mode:</span>
                    <span className="text-emerald-400 uppercase">{activePolicy?.ssh?.host_key_mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Agent Forwarding:</span>
                    <span className="text-amber-400 uppercase">{activePolicy?.ssh?.agent_forwarding}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Targets Without Approval:</span>
                    <span className="text-slate-200">{activePolicy?.automation?.max_targets_without_approval}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Production Requires Approval:</span>
                    <span className="text-emerald-400">{String(activePolicy?.automation?.production_requires_approval)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Self-Approval (Separation of Duties):</span>
                    <span className="text-red-400">{String(activePolicy?.automation?.self_approval)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Require Change Reference:</span>
                    <span className="text-emerald-400">{String(activePolicy?.automation?.require_change_reference)}</span>
                  </div>
                </div>
              </div>

              {/* SSH Agent Detection Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  Operating System SSH Agent Status
                </h3>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Agent Provider:</span>
                    <span className="text-slate-200">{agentInfo?.type || 'Searching...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Connection Endpoint:</span>
                    <span className="text-slate-300 truncate max-w-[200px]">{agentInfo?.path || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <span className="text-slate-400 font-sans">Hardware Key / FIDO2 Ready:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase bg-emerald-500/20 text-emerald-300">
                      ACTIVE
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Diagnostics Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-amber-400" />
                    Support Diagnostics & Automated Redaction
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generates an operator-reviewed technical diagnostic bundle. All private keys, passwords, and tokens are scrubbed automatically.
                  </p>
                </div>

                <button
                  onClick={handleGenerateBundle}
                  disabled={generatingBundle}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Eye className="w-4 h-4" />
                  Generate & Review Support Bundle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Support Bundle Modal Preview */}
      {showBundleModal && supportBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Review Scrubbed Support Diagnostic Bundle
                </h3>
              </div>
              <button onClick={() => setShowBundleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-300">
              Please review the diagnostic report below. Verified that zero credential secrets or sensitive keys are included:
            </div>

            <pre className="mt-3 flex-1 overflow-y-auto bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-200/90 max-h-72">
              {JSON.stringify(supportBundle, null, 2)}
            </pre>

            <div className="mt-5 flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowBundleModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close
              </button>
              <button
                onClick={handleDownloadBundle}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Scrubbed Bundle JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Authenticator Setup Modal */}
      {showMfaSetupModal && mfaSetupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900 p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Configure Google Authenticator
                </h3>
              </div>
              <button onClick={() => setShowMfaSetupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              1. Open <strong>Google Authenticator</strong> (or compatible app like Microsoft Authenticator, 1Password, or Authy).
            </p>

            <div className="flex flex-col items-center justify-center py-2 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <QrCanvas text={mfaSetupData.otpauthUrl} size={160} />
              <div className="w-full text-center space-y-1">
                <div className="text-[11px] text-slate-400">Manual setup secret key:</div>
                <div className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-xs text-emerald-300">
                  <span className="select-all tracking-wider">{mfaSetupData.secret}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(mfaSetupData.secret);
                      setCopiedMfaSecret(true);
                      setTimeout(() => setCopiedMfaSecret(false), 2000);
                    }}
                    className="p-1 hover:text-white"
                  >
                    {copiedMfaSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              2. Enter the current 6-digit code shown in the app to activate:
            </p>

            <div>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={mfaVerifyCode}
                onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-center text-base font-mono tracking-widest text-emerald-300 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            {mfaError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{mfaError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowMfaSetupModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMfaEnable}
                disabled={mfaVerifyCode.length !== 6}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Verify & Activate MFA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable MFA Confirmation Modal */}
      {showMfaDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">
                  Disable Google Authenticator
                </h3>
              </div>
              <button onClick={() => setShowMfaDisableModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Disabling MFA reduces your terminal workstation security. Please enter your workstation master password to confirm:
            </p>

            <div>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="password"
                  placeholder="Enter workstation master password..."
                  value={mfaDisablePassword}
                  onChange={(e) => setMfaDisablePassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>
            </div>

            {mfaError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{mfaError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowMfaDisableModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDisableMfa}
                disabled={!mfaDisablePassword}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md"
              >
                Confirm & Disable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
