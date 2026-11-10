import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Terminal,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Folder as FolderIcon,
  HardDrive,
  ExternalLink,
  Laptop,
  Play,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Folder } from '../../domain/types';

interface MobaToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLocalBash: () => void;
  onRefreshProfiles: () => void;
  folders?: Folder[];
  initialTab?: 'x11' | 'bash' | 'putty' | 'rdp';
}

export const MobaToolsModal: React.FC<MobaToolsModalProps> = ({
  isOpen,
  onClose,
  onOpenLocalBash,
  onRefreshProfiles,
  folders = [],
  initialTab = 'x11'
}) => {
  const [activeTab, setActiveTab] = useState<'x11' | 'bash' | 'putty' | 'rdp'>(initialTab);

  // X11 Server States
  const [x11Status, setX11Status] = useState<{ isRunning: boolean; port: number; display: string; detectedServers: any[] } | null>(null);
  const [isCheckingX11, setIsCheckingX11] = useState(false);
  const [isInstallingVcXsrv, setIsInstallingVcXsrv] = useState(false);
  const [x11Message, setX11Message] = useState('');

  // PuTTY Importer States
  const [puttySessions, setPuttySessions] = useState<any[]>([]);
  const [selectedPuttyIndices, setSelectedPuttyIndices] = useState<Record<number, boolean>>({});
  const [isLoadingPutty, setIsLoadingPutty] = useState(false);
  const [puttyFolderId, setPuttyFolderId] = useState<string | null>(null);
  const [puttyImportResult, setPuttyImportResult] = useState<{ success?: boolean; count?: number; error?: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // RDP Launcher States
  const [rdpHost, setRdpHost] = useState('');
  const [rdpPort, setRdpPort] = useState('3389');
  const [rdpStatus, setRdpStatus] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      checkX11Status();
      loadPuttySessions();
    }
  }, [isOpen, initialTab]);

  const checkX11Status = async (keepMessage: boolean = false) => {
    setIsCheckingX11(true);
    if (!keepMessage) setX11Message('');
    try {
      const status = await (window as any).dgodterm?.getX11Status?.();
      if (status) setX11Status(status);
    } catch (e: any) {
      console.warn('Failed to query X11 status:', e);
    } finally {
      setIsCheckingX11(false);
    }
  };

  const handleLaunchX11 = async () => {
    const hasInstalled = x11Status?.detectedServers?.some((s: any) => s.exists);
    if (!hasInstalled) {
      setX11Message('⚠️ Cannot start: No X11 display server installed. Click "Install VcXsrv via winget (1-Click)" below to install it.');
      return;
    }
    setX11Message('Launching X11 server...');
    try {
      const res = await (window as any).dgodterm?.launchX11Server?.();
      setX11Message(res?.message || 'X11 Server launched');
      await checkX11Status(true);
    } catch (e: any) {
      setX11Message(e.message || 'Failed to launch X11 server');
    }
  };

  const handleInstallVcXsrv = async () => {
    setIsInstallingVcXsrv(true);
    setX11Message('Installing VcXsrv Windows X Server via winget... This will take ~30-60 seconds. Please wait.');
    try {
      const res = await (window as any).dgodterm?.installVcXsrv?.();
      setX11Message(res?.message || 'VcXsrv installation finished.');
      await checkX11Status(true);
    } catch (e: any) {
      setX11Message(`Installation failed: ${e.message}. You can download manually from https://sourceforge.net/projects/vcxsrv/`);
    } finally {
      setIsInstallingVcXsrv(false);
    }
  };

  const loadPuttySessions = async () => {
    setIsLoadingPutty(true);
    setPuttyImportResult(null);
    try {
      const sessions = await (window as any).dgodterm?.getPuTTYAvailableSessions?.();
      const list = sessions || [];
      setPuttySessions(list);
      const selected: Record<number, boolean> = {};
      list.forEach((_: any, idx: number) => { selected[idx] = true; });
      setSelectedPuttyIndices(selected);
    } catch (e: any) {
      setPuttySessions([]);
    } finally {
      setIsLoadingPutty(false);
    }
  };

  const handleImportPuttySessions = async () => {
    const toImport = puttySessions.filter((_, idx) => selectedPuttyIndices[idx]);
    if (toImport.length === 0) return;
    setIsImporting(true);
    try {
      const res = await (window as any).dgodterm?.importPuTTYProfiles?.(toImport, puttyFolderId);
      setPuttyImportResult({ success: true, count: res?.importedCount || toImport.length });
      onRefreshProfiles();
    } catch (e: any) {
      setPuttyImportResult({ success: false, error: e.message || 'Import failed' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleLaunchRdp = async () => {
    if (!rdpHost.trim()) return;
    try {
      await (window as any).dgodterm?.launchRdp?.(rdpHost.trim(), parseInt(rdpPort, 10) || 3389);
      setRdpStatus(`Remote Desktop client connected to ${rdpHost.trim()}:${rdpPort}`);
      setTimeout(() => setRdpStatus(''), 4000);
    } catch (e: any) {
      setRdpStatus(`RDP Launch failed: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">MobaXterm Power Tools Suite</h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-500/40 font-bold uppercase">
                  Integrated
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                X11 Display Server, Local Unix Bash, PuTTY Registry Importer &amp; RDP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('x11')}
            className={`flex-1 py-3 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'x11'
                ? 'border-purple-500 text-purple-300 bg-slate-900/50 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Monitor className="w-4 h-4 text-purple-400" />
            <span>X11 Display Server</span>
          </button>
          <button
            onClick={() => setActiveTab('bash')}
            className={`flex-1 py-3 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'bash'
                ? 'border-purple-500 text-purple-300 bg-slate-900/50 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Local Unix (Bash)</span>
          </button>
          <button
            onClick={() => setActiveTab('putty')}
            className={`flex-1 py-3 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'putty'
                ? 'border-purple-500 text-purple-300 bg-slate-900/50 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>PuTTY Sessions</span>
          </button>
          <button
            onClick={() => setActiveTab('rdp')}
            className={`flex-1 py-3 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'rdp'
                ? 'border-purple-500 text-purple-300 bg-slate-900/50 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Laptop className="w-4 h-4 text-sky-400" />
            <span>Remote Desktop (RDP)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: X11 DISPLAY SERVER */}
          {activeTab === 'x11' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-purple-400" />
                    <span>Remote Linux GUI Application Forwarding (ssh -X)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Just like MobaXterm, DgodTerm bridges remote X11 graphical sessions directly to your Windows desktop. When you run Linux GUI apps (<code className="text-purple-300 font-mono text-[11px]">xeyes</code>, <code className="text-purple-300 font-mono text-[11px]">gedit</code>, <code className="text-purple-300 font-mono text-[11px]">virt-manager</code>, <code className="text-purple-300 font-mono text-[11px]">wireshark</code>), they project seamlessly as floating native Windows apps via local display <code className="text-purple-300 font-mono text-[11px]">127.0.0.1:6000 (:0.0)</code>.
                  </p>
                </div>
                <button
                  onClick={checkX11Status}
                  disabled={isCheckingX11}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isCheckingX11 ? 'animate-spin' : ''}`} />
                  <span>Check Status</span>
                </button>
              </div>

              {/* Status & Control Hero Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">X11 Display Server Status:</span>
                    <div className="flex items-center gap-2 mt-1">
                      {x11Status?.isRunning ? (
                        <span className="px-2.5 py-1 rounded text-xs font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>ACTIVE ON 127.0.0.1:6000 (:0.0)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded text-xs font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span>STANDBY / NOT LISTENING</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {!x11Status?.isRunning ? (
                    <button
                      onClick={handleLaunchX11}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg transition cursor-pointer flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Local X Server</span>
                    </button>
                  ) : (
                    <div className="text-right">
                      <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Ready for ssh -X GUI apps</span>
                      </span>
                    </div>
                  )}
                </div>

                {x11Message && (
                  <div className="text-xs text-purple-300 font-mono p-2.5 rounded bg-purple-950/40 border border-purple-800/60 flex items-center gap-2">
                    {isInstallingVcXsrv && <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400 shrink-0" />}
                    <span>{x11Message}</span>
                  </div>
                )}
              </div>

              {/* Not Installed Setup Helper */}
              {!(x11Status?.detectedServers?.some((s: any) => s.exists)) && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/40 space-y-3 shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-500/30 text-amber-400 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-white">No Windows X11 Server Installed Yet</h5>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        To project Linux GUI applications (like <span className="text-purple-300 font-mono">xeyes</span>, <span className="text-purple-300 font-mono">gedit</span>, <span className="text-purple-300 font-mono">virt-manager</span>) onto your Windows desktop, an X11 server is required. Click below to install <strong>VcXsrv</strong> in 1 click via winget, or download it from SourceForge.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      onClick={handleInstallVcXsrv}
                      disabled={isInstallingVcXsrv}
                      className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isInstallingVcXsrv ? 'Installing VcXsrv via winget...' : '⚡ Install VcXsrv (1-Click winget)'}</span>
                    </button>
                    <a
                      href="https://sourceforge.net/projects/vcxsrv/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Download VcXsrv (SourceForge)</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                </div>
              )}

              {/* Detected Server Engines */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Detected Local Windows X Servers:</span>
                <div className="divide-y divide-slate-800/80">
                  {(x11Status?.detectedServers || []).map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <span className="font-medium text-slate-200">{s.name}</span>
                        <span className="text-[10px] text-slate-500 block font-mono">{s.path}</span>
                      </div>
                      {s.exists ? (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                          <Check className="w-3 h-3" />
                          <span>Detected</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600">Not Installed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick instructions */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
                <span className="font-semibold text-slate-300 block">How to use X11 Forwarding:</span>
                <p className="text-[11px]">
                  1. In any SSH Connection Profile &rarr; <strong>SSH Options</strong>, enable <strong>"Enable X11 GUI Forwarding (ssh -X)"</strong>.
                </p>
                <p className="text-[11px]">
                  2. Connect to your Linux host. The terminal banner will display <strong className="text-purple-300">X11 ACTIVE (:0.0)</strong>.
                </p>
                <p className="text-[11px]">
                  3. Run any graphical command (e.g. <code className="text-purple-300 font-mono">xeyes &amp;</code> or <code className="text-purple-300 font-mono">virt-manager &amp;</code>). The window will pop up right on your Windows desktop!
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: LOCAL UNIX TERMINAL (BASH) */}
          {activeTab === 'bash' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>MobaXterm-style Local Unix Terminal (Bash &amp; Coreutils)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Enjoy a full POSIX GNU environment on Windows without having to boot WSL2 or a virtual machine.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                      <span>GNU Bash Shell &amp; Utilities</span>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-500/40">ConPTY Native</span>
                    </span>
                    <p className="text-xs text-slate-400">
                      Pre-configured with <code className="text-cyan-300 font-mono text-[11px]">grep</code>, <code className="text-cyan-300 font-mono text-[11px]">awk</code>, <code className="text-cyan-300 font-mono text-[11px]">sed</code>, <code className="text-cyan-300 font-mono text-[11px]">curl</code>, <code className="text-cyan-300 font-mono text-[11px]">rsync</code>, <code className="text-cyan-300 font-mono text-[11px]">tar</code>, and <code className="text-cyan-300 font-mono text-[11px]">ssh</code>.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onOpenLocalBash();
                      onClose();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg transition cursor-pointer flex items-center gap-2 group"
                  >
                    <span>Launch Local Bash</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Shell</span>
                    <span className="text-xs font-semibold text-slate-200">GNU bash</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Terminal Type</span>
                    <span className="text-xs font-semibold text-slate-200">xterm-256color</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Color Support</span>
                    <span className="text-xs font-semibold text-slate-200">24-bit TrueColor</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Host Subsystem</span>
                    <span className="text-xs font-semibold text-slate-200">Windows ConPTY</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PUTTY & MOBAXTERM IMPORTER */}
          {activeTab === 'putty' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>PuTTY &amp; MobaXterm Registry Session Importer</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Directly discover and import saved PuTTY and MobaXterm connections from the Windows Registry (<code className="text-amber-300 font-mono text-[11px]">HKCU\Software\SimonTatham\PuTTY\Sessions</code>).
                  </p>
                </div>
                <button
                  onClick={loadPuttySessions}
                  disabled={isLoadingPutty}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoadingPutty ? 'animate-spin' : ''}`} />
                  <span>Rescan Registry</span>
                </button>
              </div>

              {/* Target Folder Selector */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                <FolderIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-medium text-slate-300">Assign to Folder:</span>
                <select
                  value={puttyFolderId || ''}
                  onChange={(e) => setPuttyFolderId(e.target.value || null)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">(No Folder / Root)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Sessions Table */}
              {isLoadingPutty ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                  <span>Scanning Windows Registry for saved sessions...</span>
                </div>
              ) : puttySessions.length === 0 ? (
                <div className="py-10 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">No saved PuTTY sessions found</div>
                  <p className="text-[11px] text-slate-500">
                    No session keys were detected under HKCU\Software\SimonTatham\PuTTY\Sessions on this Windows machine.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-400">
                      Found <strong className="text-white">{puttySessions.length}</strong> saved sessions in registry:
                    </span>
                    <button
                      onClick={() => {
                        const allSelected = Object.values(selectedPuttyIndices).every(Boolean);
                        const next: Record<number, boolean> = {};
                        puttySessions.forEach((_, idx) => { next[idx] = !allSelected; });
                        setSelectedPuttyIndices(next);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                    >
                      {Object.values(selectedPuttyIndices).every(Boolean) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/80 divide-y divide-slate-850">
                    {puttySessions.map((s, idx) => {
                      const isChecked = selectedPuttyIndices[idx] !== false;
                      return (
                        <label
                          key={s.rawName || idx}
                          className={`flex items-center justify-between p-2.5 px-3 cursor-pointer transition hover:bg-slate-900/80 ${
                            isChecked ? 'bg-amber-950/15' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedPuttyIndices((prev) => ({ ...prev, [idx]: e.target.checked }));
                              }}
                              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-white text-xs block truncate">{s.name}</span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {s.username}@{s.hostname}:{s.port}
                              </span>
                            </div>
                          </div>
                          {s.keyPath && (
                            <span className="text-[10px] text-amber-300 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 truncate max-w-[200px]" title={s.keyPath}>
                              PPK Key
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400">
                      Selected: <strong className="text-amber-300">{Object.values(selectedPuttyIndices).filter(Boolean).length}</strong> / {puttySessions.length}
                    </span>
                    <button
                      onClick={handleImportPuttySessions}
                      disabled={isImporting || Object.values(selectedPuttyIndices).filter(Boolean).length === 0}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2 text-xs shadow-md cursor-pointer transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isImporting ? 'Importing Sessions...' : `Import Selected (${Object.values(selectedPuttyIndices).filter(Boolean).length})`}</span>
                    </button>
                  </div>
                </div>
              )}

              {puttyImportResult && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    puttyImportResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {puttyImportResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Successfully imported {puttyImportResult.count} session(s) into DgodTerm!</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{puttyImportResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REMOTE DESKTOP (RDP) */}
          {activeTab === 'rdp' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-sky-400" />
                    <span>Native Windows Remote Desktop (RDP) Launcher</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Launch remote desktop sessions to Windows servers directly from DgodTerm with customized port and display targeting.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">Hostname or IP Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.100 or win-server.corp"
                      value={rdpHost}
                      onChange={(e) => setRdpHost(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">RDP Port</label>
                    <input
                      type="text"
                      value={rdpPort}
                      onChange={(e) => setRdpPort(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">
                    Launches Microsoft Remote Desktop client (<code className="font-mono text-slate-400">mstsc.exe /v:target:port</code>)
                  </span>
                  <button
                    onClick={handleLaunchRdp}
                    disabled={!rdpHost.trim()}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch RDP Session</span>
                  </button>
                </div>

                {rdpStatus && (
                  <div className="text-xs text-sky-300 font-mono p-2 rounded bg-sky-950/30 border border-sky-800/40">
                    {rdpStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
