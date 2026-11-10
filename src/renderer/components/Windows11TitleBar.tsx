import React, { useRef, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Terminal,
  HardDrive,
  Code,
  Plus,
  ChevronDown,
  X,
  Minus,
  Square,
  Copy,
  Sliders,
  ShieldCheck,
  Lock,
  Key,
  Network,
  Settings,
  PanelLeftOpen,
  PanelLeftClose,
  Zap,
  Globe
} from 'lucide-react';
import { DistroIcon } from './DistroIcon';
import { ConnectionProfile } from '../../domain/types';
import { TabItem } from '../App';

interface Windows11TitleBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onOpenLocalTerminal: (shellId: 'powershell' | 'cmd' | 'wsl' | 'bash') => void;
  onOpenQuickConnect: () => void;
  onOpenSettings: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  accentColor?: string;
  isElectron?: boolean;
}

export const Windows11TitleBar: React.FC<Windows11TitleBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onOpenLocalTerminal,
  onOpenQuickConnect,
  onOpenSettings,
  isSidebarCollapsed,
  onToggleSidebar,
  accentColor = 'sky',
  isElectron = false
}) => {
  const [showNewTabMenu, setShowNewTabMenu] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const newTabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newTabRef.current && !newTabRef.current.contains(e.target as Node)) {
        setShowNewTabMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = () => {
    (window as any).dgodterm?.minimizeWindow?.();
  };

  const handleMaximize = () => {
    (window as any).dgodterm?.maximizeWindow?.();
    setIsMaximized((prev) => !prev);
  };

  const handleClose = () => {
    (window as any).dgodterm?.closeWindow?.();
  };

  const accentBorderColor =
    {
      sky: '#0078d4',
      indigo: '#6366f1',
      emerald: '#10b981',
      rose: '#f43f5e',
      amber: '#f59e0b',
      cyan: '#06b6d4'
    }[accentColor] || '#0078d4';

  return (
    <div
      className="h-[38px] bg-[#1a1a1a] text-white flex items-center select-none border-b border-white/[0.07] shrink-0 relative z-50"
      style={{
        fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
        WebkitAppRegion: 'drag'
      } as any}
    >
      {/* App Branding & Sidebar Toggle */}
      <div
        className="flex items-center gap-1.5 pl-3 pr-2 h-full"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-[4px] hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          title={isSidebarCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5 text-[#60cdff]" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5 text-white/60" />
          )}
        </button>

        <div className="flex items-center gap-1.5 ml-0.5">
          <div className="w-4 h-4 rounded-[3px] bg-[#0078d4] flex items-center justify-center shadow-sm">
            <Terminal className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-[12px] font-semibold text-white tracking-tight hidden md:inline">
            DgodTerm
          </span>
        </div>
      </div>

      <div className="h-4 w-px bg-white/10 mx-1 shrink-0" />

      {/* Windows Terminal Style Tab Strip */}
      <div
        className="flex-1 flex items-center h-full min-w-0 overflow-x-auto no-scrollbar gap-1 px-1"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center gap-2 h-[30px] px-3 rounded-[6px] text-[12px] cursor-pointer transition-all border shrink-0 max-w-[200px] select-none ${
                isActive
                  ? 'bg-[#2b2b2b] text-white font-medium border-white/10 shadow-sm'
                  : 'bg-transparent text-white/70 hover:bg-white/[0.06] hover:text-white border-transparent'
              }`}
              style={{
                borderBottomColor: isActive ? accentBorderColor : 'transparent',
                borderBottomWidth: isActive ? '2px' : '1px'
              }}
              title={tab.title}
            >
              {/* Tab Icon */}
              <span className="shrink-0">
                {tab.type === 'dashboard' && <LayoutDashboard className="w-3.5 h-3.5 text-[#60cdff]" />}
                {tab.type === 'terminal' && (
                  tab.profile?.id === 'local-wsl' ? (
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  ) : tab.profile?.id === 'local-cmd' ? (
                    <Code className="w-3.5 h-3.5 text-amber-400" />
                  ) : tab.profile?.id === 'local-bash' ? (
                    <DistroIcon flavor="bash" className="w-3.5 h-3.5" />
                  ) : tab.profile?.id?.startsWith('local-') ? (
                    <Terminal className="w-3.5 h-3.5 text-[#60cdff]" />
                  ) : tab.profile?.os_flavor ? (
                    <DistroIcon flavor={tab.profile.os_flavor} className="w-3.5 h-3.5" />
                  ) : (
                    <Terminal className="w-3.5 h-3.5 text-[#60cdff]" />
                  )
                )}
                {tab.type === 'sftp' && <HardDrive className="w-3.5 h-3.5 text-emerald-400" />}
                {tab.type === 'ansible' && <Sliders className="w-3.5 h-3.5 text-indigo-400" />}
                {tab.type === 'trust' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                {tab.type === 'audit' && <Lock className="w-3.5 h-3.5 text-[#60cdff]" />}
                {tab.type === 'vault' && <Key className="w-3.5 h-3.5 text-amber-400" />}
                {tab.type === 'tunnels' && <Network className="w-3.5 h-3.5 text-purple-400" />}
                {tab.type === 'settings' && <Settings className="w-3.5 h-3.5 text-purple-400" />}
              </span>

              {/* Tab Title */}
              <span className="truncate flex-1 font-normal text-[12px]">{tab.title}</span>

              {/* Tab Close Button */}
              {tab.type !== 'dashboard' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="w-4 h-4 rounded-[3px] flex items-center justify-center text-white/50 hover:bg-[#c42b1c] hover:text-white transition-colors ml-0.5 cursor-pointer"
                  title="Close Tab (Ctrl+W)"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Windows Terminal Plus (+) New Tab Dropdown */}
        <div className="relative shrink-0" ref={newTabRef}>
          <div className="flex items-center rounded-[5px] hover:bg-white/10 transition-colors">
            <button
              onClick={() => onOpenLocalTerminal('powershell')}
              className="p-1 text-white/70 hover:text-white cursor-pointer"
              title="New Terminal (PowerShell)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowNewTabMenu((prev) => !prev)}
              className="p-1 pl-0.5 text-white/50 hover:text-white cursor-pointer"
              title="Open Terminal Profiles"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Windows 11 MenuFlyout */}
          {showNewTabMenu && (
            <div className="absolute top-full left-0 mt-1 w-60 bg-[#282828] border border-white/10 rounded-[8px] shadow-[0_16px_32px_rgba(0,0,0,0.5)] py-1 z-50 text-[12px] animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                Local Windows Shells
              </div>
              <button
                onClick={() => {
                  onOpenLocalTerminal('powershell');
                  setShowNewTabMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-[#60cdff]" />
                <span>Windows PowerShell</span>
              </button>
              <button
                onClick={() => {
                  onOpenLocalTerminal('cmd');
                  setShowNewTabMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-amber-400" />
                <span>Command Prompt (CMD)</span>
              </button>
              <button
                onClick={() => {
                  onOpenLocalTerminal('wsl');
                  setShowNewTabMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>WSL2 Linux Shell</span>
              </button>
              <button
                onClick={() => {
                  onOpenLocalTerminal('bash');
                  setShowNewTabMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                <DistroIcon flavor="bash" className="w-3.5 h-3.5" />
                <span>Local Unix Bash (MobaXterm)</span>
              </button>

              <div className="h-px bg-white/10 my-1" />

              <button
                onClick={() => {
                  onOpenQuickConnect();
                  setShowNewTabMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/10 text-left text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Connect SSH / SFTP...</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Windows 11 Native Caption Buttons (rendered when not covered by Electron titleBarOverlay) */}
      {!isElectron && (
        <div
          className="flex items-center h-full shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <button
            onClick={handleMinimize}
            className="w-[46px] h-full flex items-center justify-center text-white/70 hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-[46px] h-full flex items-center justify-center text-white/70 hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
            title={isMaximized ? 'Restore Down' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-[46px] h-full flex items-center justify-center text-white/70 hover:bg-[#c42b1c] hover:text-white active:bg-[#a31f12] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Padding space when Electron titleBarOverlay renders native caption buttons on Windows */}
      {isElectron && <div className="w-[140px] shrink-0" />}
    </div>
  );
};
