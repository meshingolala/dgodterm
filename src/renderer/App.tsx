import React, { useState, useEffect, useRef } from 'react';
import { ConnectionProfile, Folder } from '../domain/types';
import { TerminalView } from './components/TerminalView';
import { SftpView } from './components/SftpView';
import { AnsibleView } from './components/AnsibleView';
import { AuditView } from './components/AuditView';
import { TrustStoreView } from './components/TrustStoreView';
import { SettingsView } from './components/SettingsView';
import { HostVerificationModal } from './components/HostVerificationModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { ImportExportModal } from './components/ImportExportModal';
import { PasswordPromptModal } from './components/PasswordPromptModal';
import { PasswordVaultView } from './components/PasswordVaultView';
import { TunnelManagerView } from './components/TunnelManagerView';
import { SnippetsModal } from './components/SnippetsModal';
import { SSHKeyGeneratorModal } from './components/SSHKeyGeneratorModal';
import { BroadcastBar, ActiveSessionDescriptor } from './components/BroadcastBar';
import { ConfigDriftModal } from './components/ConfigDriftModal';
import { RunbookRunnerModal } from './components/RunbookRunnerModal';
import { BreakGlassModal } from './components/BreakGlassModal';
import { AppLoginModal } from './components/AppLoginModal';
import { DashboardView } from './components/DashboardView';
import { BatchPushModal } from './components/BatchPushModal';
import { KeyDeployModal } from './components/KeyDeployModal';
import { UptimeMonitorPanel } from './components/UptimeMonitorPanel';
import { CloudImportModal } from './components/CloudImportModal';
import { HostNotesModal } from './components/HostNotesModal';
import { DistroIcon } from './components/DistroIcon';
import { v4 as uuidv4 } from 'uuid';
import { getGeneralUiSettings, saveGeneralUiSettings, GeneralUiSettings, getSessionSecuritySettings, SessionSecuritySettings } from './settings/settings-manager';

import {
  LayoutDashboard,
  Terminal,
  FolderTree,
  Folder as FolderIcon,
  FolderPlus,
  FolderMinus,
  FolderInput,
  Server,
  Star,
  Search,
  Plus,
  PlayCircle,
  FileCode,
  ShieldCheck,
  Lock,
  Key,
  Settings,
  X,
  FileUp,
  FileText,
  Sliders,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Activity,
  HardDrive,
  Check,
  Trash2,
  Edit3,
  Copy,
  Network,
  Code,
  KeyRound,
  GitCompare,
  PlaySquare,
  Flame,
  Wrench,
  Shield,
  Cpu,
  Layers,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UploadCloud,
  Cloud
} from 'lucide-react';

interface TabItem {
  id: string;
  type: 'dashboard' | 'terminal' | 'sftp' | 'ansible' | 'audit' | 'trust' | 'settings' | 'vault' | 'tunnels';
  title: string;
  sessionId?: string;
  profile?: ConnectionProfile;
  initialCommand?: string;
}

export const App: React.FC = () => {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [search, setSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Tabs
  const [tabs, setTabs] = useState<TabItem[]>([
    { id: 'tab-dashboard', type: 'dashboard', title: 'Workstation Dashboard' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-dashboard');
  const [showNewTabDropdown, setShowNewTabDropdown] = useState(false);
  const newTabDropdownRef = useRef<HTMLDivElement>(null);
  const [showFleetDropdown, setShowFleetDropdown] = useState(false);
  const fleetDropdownRef = useRef<HTMLDivElement>(null);

  // Modals
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [viewingNotesProfile, setViewingNotesProfile] = useState<ConnectionProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [pendingHostPrompt, setPendingHostPrompt] = useState<{ sessionId: string; result: any } | null>(null);
  const [pendingPasswordPrompt, setPendingPasswordPrompt] = useState<{
    sessionId: string;
    profile: ConnectionProfile;
    promptText?: string;
    targetType?: 'terminal' | 'sftp';
    initialCommand?: string;
  } | null>(null);

  // Global Snippets and Key Generator Modal states
  const [showGlobalSnippets, setShowGlobalSnippets] = useState(false);
  const [showGlobalKeyGen, setShowGlobalKeyGen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Corporate Fleet Operations & JIT Break-Glass Modals
  const [showConfigDrift, setShowConfigDrift] = useState(false);
  const [showRunbookRunner, setShowRunbookRunner] = useState(false);
  const [showBreakGlass, setShowBreakGlass] = useState(false);
  const [showBatchPush, setShowBatchPush] = useState(false);
  const [showKeyDeploy, setShowKeyDeploy] = useState(false);
  const [showUptimeMonitor, setShowUptimeMonitor] = useState(false);
  const [showCloudImport, setShowCloudImport] = useState(false);
  const [breakGlassGrant, setBreakGlassGrant] = useState<{
    incidentTicketId: string;
    expiresAt: number;
    hostLabel: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('dgodterm_breakglass_grant');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt > Date.now()) return parsed;
      }
    } catch (e) {}
    return null;
  });

  // In-Memory Password Retention & Session Timeout Settings
  const [sessionSettings, setSessionSettings] = useState<SessionSecuritySettings>(getSessionSecuritySettings);
  const [uiSettings, setUiSettings] = useState<GeneralUiSettings>(getGeneralUiSettings);
  const [draggedProfileId, setDraggedProfileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null | 'root'>(null);
  const [cachedProfileIds, setCachedProfileIds] = useState<Record<string, number>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('dgodterm_session_auth') === 'true';
    } catch {
      return false;
    }
  });
  const lastActiveTimeRef = useRef(Date.now());

  const handleLogout = async () => {
    try {
      await (window as any).dgodterm?.lockVault();
    } catch (err) {
      console.error('Lock vault failed:', err);
    }
    try {
      sessionStorage.removeItem('dgodterm_session_auth');
    } catch {}
    setIsAuthenticated(false);
    setIsLocked(true);
  };

  // Collapsible sidebar accordion sections (persisted in localStorage)
  const [collapsedNavSections, setCollapsedNavSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('dgodterm_sidebar_collapsed_sections');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Default: all expanded
    return {};
  });

  const toggleNavSection = (sectionKey: string) => {
    setCollapsedNavSections((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      try {
        localStorage.setItem('dgodterm_sidebar_collapsed_sections', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const [hostResources, setHostResources] = useState<{
    cpuPercent: number;
    ramUsedGB: number;
    ramTotalGB: number;
    ramPercent: number;
    diskUsedGB: number;
    diskTotalGB: number;
    diskPercent: number;
  } | null>(null);

  // Live reachability status for fleet host profiles: 'up' | 'down' | 'unknown'
  const [hostStatusMap, setHostStatusMap] = useState<Record<string, 'up' | 'down' | 'unknown'>>({});
  const [hostUptimeMap, setHostUptimeMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!isAuthenticated || isLocked) return;
    let mounted = true;
    const fetchResources = async () => {
      try {
        if ((window as any).dgodterm?.getHostResources) {
          const res = await (window as any).dgodterm.getHostResources();
          if (mounted && res) setHostResources(res);
        }
      } catch (e) {}
    };
    fetchResources();
    const interval = setInterval(fetchResources, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, isLocked]);

  // Poll uptime status & reachability for dashboard & left sidebar
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;
    let mounted = true;
    const fetchHostUptime = async () => {
      try {
        const res = await (window as any).dgodterm?.invokeFeature('uptime:status');
        if (mounted && res?.hosts) {
          const nextMap: Record<string, 'up' | 'down' | 'unknown'> = {};
          const nextUptimeMap: Record<string, any> = {};
          res.hosts.forEach((h: any) => {
            if (h.profileId) {
              nextMap[h.profileId] = h.status;
              nextUptimeMap[h.profileId] = h;
            }
          });
          setHostStatusMap((prev) => ({ ...prev, ...nextMap }));
          setHostUptimeMap((prev) => ({ ...prev, ...nextUptimeMap }));
        }
      } catch (e) {}
    };

    fetchHostUptime();
    const interval = setInterval(fetchHostUptime, 4000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, isLocked]);

  useEffect(() => {
    const handleSettingsUpdated = () => {
      setSessionSettings(getSessionSecuritySettings());
    };
    const handleUiSettingsUpdated = (e: any) => {
      setUiSettings(e.detail || getGeneralUiSettings());
    };
    window.addEventListener('dgodterm:settings-updated', handleSettingsUpdated);
    window.addEventListener('dgodterm:session-settings-updated', handleSettingsUpdated);
    window.addEventListener('dgodterm:ui-settings-updated', handleUiSettingsUpdated);
    return () => {
      window.removeEventListener('dgodterm:settings-updated', handleSettingsUpdated);
      window.removeEventListener('dgodterm:session-settings-updated', handleSettingsUpdated);
      window.removeEventListener('dgodterm:ui-settings-updated', handleUiSettingsUpdated);
    };
  }, []);

  // JIT Break-Glass auto-expiration check
  useEffect(() => {
    if (!breakGlassGrant) return;
    const interval = setInterval(() => {
      if (Date.now() >= breakGlassGrant.expiresAt) {
        setBreakGlassGrant(null);
        localStorage.removeItem('dgodterm_breakglass_grant');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [breakGlassGrant]);

  // Dynamically sync root rem sizing & typography properties across the DOM
  useEffect(() => {
    const rootFontSizePercent = ((uiSettings.appFontSize || 13) / 13) * 100;
    document.documentElement.style.fontSize = `${rootFontSizePercent}%`;
    document.documentElement.style.setProperty(
      '--dgod-app-font',
      uiSettings.appFontFamily || "'Inter', system-ui, -apple-system, sans-serif"
    );
    document.documentElement.style.setProperty('--dgod-base-font-size', `${uiSettings.appFontSize || 13}px`);
  }, [uiSettings.appFontSize, uiSettings.appFontFamily]);

  // User activity tracker for workstation inactivity lockout
  useEffect(() => {
    const recordActivity = () => {
      lastActiveTimeRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'keyup', 'wheel', 'touchstart', 'pointerdown', 'focus', 'click'];
    events.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));
    window.addEventListener('dgodterm:user-activity', recordActivity);
    window.addEventListener('dgodterm:lock-request', handleLogout);

    const interval = setInterval(async () => {
      if (isLocked || !isAuthenticated) return;

      const timeoutMins = sessionSettings.screenLockTimeoutMinutes;
      if (!sessionSettings.autoLockoutEnabled || timeoutMins <= 0) return;

      const now = Date.now();
      const localIdleSeconds = (now - lastActiveTimeRef.current) / 1000;

      let osIdleSeconds = 0;
      try {
        if ((window as any).dgodterm?.getSystemIdleTime) {
          osIdleSeconds = await (window as any).dgodterm.getSystemIdleTime();
        }
      } catch {}

      const timeoutSeconds = timeoutMins * 60;
      if (localIdleSeconds >= timeoutSeconds || (osIdleSeconds >= timeoutSeconds && localIdleSeconds >= 5)) {
        console.log(`[DgodTerm] Inactivity timeout reached (${timeoutMins} min). Auto-locking workstation.`);
        handleLogout();
      }
    }, 1000);

    const unsubLock = (window as any).dgodterm?.onSystemLockScreen?.(() => {
      if (sessionSettings.lockOnOsLock !== false && isAuthenticated && !isLocked) {
        console.log('[DgodTerm] OS screen locked. Auto-locking workstation.');
        handleLogout();
      }
    });

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      window.removeEventListener('dgodterm:user-activity', recordActivity);
      window.removeEventListener('dgodterm:lock-request', handleLogout);
      clearInterval(interval);
      if (unsubLock) unsubLock();
    };
  }, [isLocked, isAuthenticated, sessionSettings.autoLockoutEnabled, sessionSettings.screenLockTimeoutMinutes, sessionSettings.lockOnOsLock]);

  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Sidebar collapse & drag-to-resize states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dgodterm_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dgodterm_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const isDraggingSidebarRef = useRef(false);
  const sidebarWidthRef = useRef(uiSettings.sidebarWidth || 260);
  sidebarWidthRef.current = uiSettings.sidebarWidth || 260;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebarRef.current) return;
      // Clamp between min 180px and max 640px (or 50% of window width)
      const maxAllowed = Math.min(640, Math.floor(window.innerWidth * 0.55));
      const minAllowed = 180;
      const newWidth = Math.max(minAllowed, Math.min(maxAllowed, e.clientX));
      
      setUiSettings((prev) => {
        const next = { ...prev, sidebarWidth: newWidth };
        return next;
      });
    };

    const handleMouseUp = () => {
      if (isDraggingSidebarRef.current) {
        isDraggingSidebarRef.current = false;
        setIsDraggingSidebar(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Persist the final sidebar width to settings storage
        const current = getGeneralUiSettings();
        saveGeneralUiSettings({ ...current, sidebarWidth: sidebarWidthRef.current });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleStartSidebarDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebarRef.current = true;
    setIsDraggingSidebar(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    loadData();

    // Listen to host verification events
    const unsubscribeHost = (window as any).dgodterm.onHostVerificationPrompt(
      (sessionId: string, result: any) => {
        setPendingHostPrompt({ sessionId, result });
      }
    );

    // Listen to password / keyboard-interactive prompt events
    const unsubscribePass = (window as any).dgodterm.onPasswordPrompt?.(
      (sessionId: string, promptText: string) => {
        const p = profilesRef.current.find((prof) => prof.id);
        const tab = tabsRef.current.find((t) => t.sessionId === sessionId);
        const profile = tab?.profile || p;
        if (profile) {
          setPendingPasswordPrompt({ sessionId, profile, promptText });
        }
      }
    );

    // Listen to real-time detected Linux distributions/flavours on first login
    const unsubscribeFlavor = (window as any).dgodterm.onProfileFlavorDetected?.(
      ({ profileId, flavor, osName }: { profileId: string; flavor: string; osName: string }) => {
        setProfiles((prev) =>
          prev.map((prof) =>
            prof.id === profileId
              ? { ...prof, os_flavor: flavor, os_name: osName }
              : prof
          )
        );
        setTabs((prev) =>
          prev.map((tab) =>
            tab.profile?.id === profileId
              ? { ...tab, profile: { ...tab.profile, os_flavor: flavor, os_name: osName } }
              : tab
          )
        );
      }
    );

    return () => {
      unsubscribeHost();
      if (unsubscribePass) unsubscribePass();
      if (unsubscribeFlavor) unsubscribeFlavor();
    };
  }, []);

  const loadData = async () => {
    try {
      const p = await (window as any).dgodterm.getProfiles();
      const f = await (window as any).dgodterm.getFolders();
      setProfiles(p);
      setFolders(f);

      // Preserve existing folder expanded/collapsed states
      setExpandedFolders((prev) => {
        const next = { ...prev };
        f.forEach((folder: Folder) => {
          if (next[folder.id] === undefined) {
            next[folder.id] = true;
          }
        });
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const isCurrentlyExpanded = prev[folderId] !== false;
      return { ...prev, [folderId]: !isCurrentlyExpanded };
    });
  };

  const collapseAllFolders = () => {
    const next: Record<string, boolean> = {};
    folders.forEach((f) => {
      next[f.id] = false;
    });
    setExpandedFolders(next);
  };

  const expandAllFolders = () => {
    const next: Record<string, boolean> = {};
    folders.forEach((f) => {
      next[f.id] = true;
    });
    setExpandedFolders(next);
  };

  const handleOpenTerminal = (profile: ConnectionProfile, initialCommand?: string) => {
    const sessionId = uuidv4();

    // Check if key file is configured
    const hasConfiguredKey =
      profile.auth_reference?.kind === 'key_file_reference' &&
      Boolean(profile.auth_reference.key_path);

    // Check if vault credential is configured
    const hasVaultCredential =
      profile.auth_reference?.kind === 'vault_reference' &&
      Boolean(profile.auth_reference.reference_id);

    // Check in-memory password retention
    const cachedExpiry = cachedProfileIds[profile.id];
    const isPasswordCached =
      cachedExpiry !== undefined &&
      (sessionSettings.passwordRetentionMinutes === -1 || Date.now() < cachedExpiry);

    const needsPassword = !hasConfiguredKey && !hasVaultCredential && !isPasswordCached;

    if (needsPassword) {
      setPendingPasswordPrompt({
        sessionId,
        profile,
        targetType: 'terminal',
        promptText: `Enter SSH password for ${profile.username}@${profile.hostname}:`,
        initialCommand
      });
      return;
    }

    launchTerminalTab(sessionId, profile, initialCommand);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newTabDropdownRef.current && !newTabDropdownRef.current.contains(e.target as Node)) {
        setShowNewTabDropdown(false);
      }
      if (fleetDropdownRef.current && !fleetDropdownRef.current.contains(e.target as Node)) {
        setShowFleetDropdown(false);
      }
    };
    if (showNewTabDropdown || showFleetDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showNewTabDropdown, showFleetDropdown]);

  const handleOpenLocalTerminal = (shellId: 'powershell' | 'cmd' | 'wsl') => {
    const sessionId = uuidv4();
    const nameMap: Record<string, string> = {
      powershell: 'Local PowerShell',
      cmd: 'Local Command Prompt',
      wsl: 'Local WSL2 (Linux)'
    };
    const displayName = nameMap[shellId] || 'Local Shell';
    const pseudoProfile: ConnectionProfile = {
      id: `local-${shellId}`,
      schema_version: 1,
      display_name: displayName,
      hostname: 'localhost',
      port: 0,
      username: 'local',
      folder_id: null,
      tags: ['local', shellId],
      jump_host_profile_id: null,
      auth_reference: { kind: 'agent_reference', reference_id: 'local' },
      host_trust_policy_id: null,
      ssh_options: { keepalive_interval: 0 },
      is_favorite: false,
      last_connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'system'
    };
    launchTerminalTab(sessionId, pseudoProfile);
    setShowNewTabDropdown(false);
  };

  const launchTerminalTab = (sessionId: string, profile: ConnectionProfile, initialCommand?: string) => {
    const newTab: TabItem = {
      id: `tab-ssh-${sessionId}`,
      type: 'terminal',
      title: `${profile.display_name}`,
      sessionId,
      profile,
      initialCommand
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const launchSFTPTab = (sessionId: string, profile: ConnectionProfile) => {
    const newTab: TabItem = {
      id: `tab-sftp-${sessionId}`,
      type: 'sftp',
      title: `SFTP: ${profile.display_name}`,
      sessionId,
      profile
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!pendingPasswordPrompt) return;
    const { sessionId, profile, targetType, initialCommand } = pendingPasswordPrompt;

    const retentionMins = sessionSettings.passwordRetentionMinutes ?? -1;
    await (window as any).dgodterm.submitTransientPassword(sessionId, password, retentionMins, profile.id);

    const ttlMs = retentionMins > 0 ? retentionMins * 60 * 1000 : Infinity;
    const expiry = retentionMins === 0 ? 0 : Date.now() + ttlMs;
    setCachedProfileIds((prev) => ({ ...prev, [profile.id]: expiry }));

    setPendingPasswordPrompt(null);

    // If tab doesn't exist yet, open it now!
    if (!tabs.some((t) => t.sessionId === sessionId)) {
      if (targetType === 'sftp') {
        launchSFTPTab(sessionId, profile);
      } else {
        launchTerminalTab(sessionId, profile, initialCommand);
      }
    }
  };

  const handleOpenSFTP = (profile: ConnectionProfile) => {
    const sessionId = uuidv4();

    // Check if key file is configured
    const hasConfiguredKey =
      profile.auth_reference?.kind === 'key_file_reference' &&
      Boolean(profile.auth_reference.key_path);

    // Check if vault credential is configured
    const hasVaultCredential =
      profile.auth_reference?.kind === 'vault_reference' &&
      Boolean(profile.auth_reference.reference_id);

    // Check in-memory password retention
    const cachedExpiry = cachedProfileIds[profile.id];
    const isPasswordCached =
      cachedExpiry !== undefined &&
      (sessionSettings.passwordRetentionMinutes === -1 || Date.now() < cachedExpiry);

    const needsPassword = !hasConfiguredKey && !hasVaultCredential && !isPasswordCached;

    if (needsPassword) {
      setPendingPasswordPrompt({
        sessionId,
        profile,
        targetType: 'sftp',
        promptText: `Enter SFTP password for ${profile.username}@${profile.hostname}:`
      });
      return;
    }

    launchSFTPTab(sessionId, profile);
  };

  const handleCloseTab = (tabId: string) => {
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (tabToClose?.type === 'terminal' && tabToClose.sessionId && uiSettings.confirmCloseSession) {
      const ok = window.confirm(`Are you sure you want to close active terminal session "${tabToClose.title}"?`);
      if (!ok) return;
    }
    if (tabToClose?.sessionId) {
      if (tabToClose.type === 'terminal') {
        (window as any).dgodterm.disconnectSSH(tabToClose.sessionId);
      } else if (tabToClose.type === 'sftp') {
        (window as any).dgodterm.disconnectSFTP(tabToClose.sessionId);
      }
    }
    const remaining = tabs.filter((t) => t.id !== tabId);
    if (remaining.length === 0) {
      const dashTab: TabItem = { id: 'tab-dashboard', type: 'dashboard', title: 'Workstation Dashboard' };
      setTabs([dashTab]);
      setActiveTabId('tab-dashboard');
    } else {
      setTabs(remaining);
      if (activeTabId === tabId) {
        setActiveTabId(remaining[remaining.length - 1].id);
      }
    }
  };

  const handleOpenDashboard = () => {
    if (!tabs.some((t) => t.id === 'tab-dashboard')) {
      const dashTab: TabItem = { id: 'tab-dashboard', type: 'dashboard', title: 'Workstation Dashboard' };
      setTabs([dashTab, ...tabs]);
    }
    setActiveTabId('tab-dashboard');
  };


  const handleCreateFolder = async () => {
    const name = prompt('Enter new folder name:');
    if (!name?.trim()) return;

    await (window as any).dgodterm.saveFolder({
      id: uuidv4(),
      name: name.trim(),
      parent_id: null,
      color: '#3b82f6',
      created_at: new Date().toISOString()
    });
    loadData();
  };

  const handleRenameFolder = async (folder: Folder) => {
    const newName = prompt(`Enter new name for folder "${folder.name}":`, folder.name);
    if (!newName || !newName.trim() || newName.trim() === folder.name) return;

    await (window as any).dgodterm.saveFolder({
      ...folder,
      name: newName.trim()
    });
    loadData();
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (confirm(`Delete folder "${folderName}"?\n\nAny sessions inside will be safely kept and moved to Root (No Folder).`)) {
      await (window as any).dgodterm.deleteFolder(folderId);
      loadData();
    }
  };

  const handleNewProfileInFolder = (folderId: string) => {
    setEditingProfile({
      id: '',
      schema_version: 1,
      display_name: '',
      hostname: '',
      port: 22,
      username: 'root',
      auth_reference: { kind: 'transient_prompt', reference_id: 'ref-transient' },
      folder_id: folderId,
      tags: [],
      jump_host_profile_id: null,
      host_trust_policy_id: null,
      ssh_options: {
        keepalive_interval: 30,
        agent_forwarding: false,
        x11_forwarding: false,
        terminal_type: 'xterm-256color'
      },
      is_favorite: false,
      last_connected_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'operator'
    });
    setShowProfileModal(true);
  };

  const handleDeleteProfile = async (id: string) => {
    if (confirm('Delete this connection profile?')) {
      await (window as any).dgodterm.deleteProfile(id);
      loadData();
    }
  };

  const handleMoveProfileToFolder = async (profileId: string, targetFolderId: string | null) => {
    const prof = profiles.find((p) => p.id === profileId);
    if (!prof) return;
    if (prof.folder_id === targetFolderId) return;

    const updated: ConnectionProfile = {
      ...prof,
      folder_id: targetFolderId,
      updated_at: new Date().toISOString()
    };

    await (window as any).dgodterm.saveProfile(updated);

    if (targetFolderId) {
      setExpandedFolders((prev) => ({ ...prev, [targetFolderId]: true }));
    }

    loadData();
  };

  const handleDuplicateProfile = async (profile: ConnectionProfile) => {
    const dup: ConnectionProfile = {
      ...profile,
      id: uuidv4(),
      display_name: `${profile.display_name} (Copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await (window as any).dgodterm.saveProfile(dup);
    loadData();
  };


  const handleHostVerificationResolve = async (accept: boolean, rotationData?: any) => {
    if (!pendingHostPrompt) return;

    if (accept) {
      if (rotationData) {
        await (window as any).dgodterm.rotateHostKey(rotationData);
      } else {
        await (window as any).dgodterm.acceptHostKey({
          hostname: pendingHostPrompt.result.hostname,
          port: pendingHostPrompt.result.port,
          keyType: pendingHostPrompt.result.keyType,
          fingerprint: pendingHostPrompt.result.fingerprint,
          rawPublicKey: pendingHostPrompt.result.rawPublicKey,
          verifiedBy: 'operator'
        });
      }
    }

    await (window as any).dgodterm.resolveHostVerification(pendingHostPrompt.sessionId, accept);
    setPendingHostPrompt(null);
  };

  const filteredProfiles = profiles.filter((p) => {
    const s = search.toLowerCase();
    return (
      p.display_name.toLowerCase().includes(s) ||
      p.hostname.toLowerCase().includes(s) ||
      p.username.toLowerCase().includes(s) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(s))
    );
  });

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div
      className={`flex h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden theme-${uiSettings.appTheme || 'dark'} clarity-${uiSettings.fontAntialiasing || 'subpixel'} stroke-${uiSettings.fontStrokeWeight || 'medium'}`}
      style={{
        fontFamily: uiSettings.appFontFamily || "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: `${uiSettings.appFontSize || 13}px`
      }}
    >
      {/* Sidebar */}
      <div
        className={`bg-slate-950 border-r border-slate-800 flex flex-col h-full shrink-0 relative transition-[width,opacity] duration-200 overflow-hidden ${
          isSidebarCollapsed ? 'w-0 border-r-0 p-0 opacity-0 pointer-events-none' : ''
        } ${
          isDraggingSidebar ? 'select-none transition-none' : ''
        }`}
        style={{ width: isSidebarCollapsed ? 0 : `${uiSettings.sidebarWidth}px` }}
      >
        {/* Brand Header with Quick Theme Mode Toggle & Collapse Sidebar Button */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between min-w-0">
          <div
            onClick={handleOpenDashboard}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
            title="Open Workstation Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Terminal className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-wide text-white truncate group-hover:text-sky-300 transition-colors">DgodTerm</h1>
              <p className="text-[10px] text-slate-400 font-medium truncate">Secure SSH & Ansible</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* 1-Click Dark / Dark-Gray Slate Theme Switcher */}
            <button
              onClick={() => {
                const currentTheme = uiSettings.appTheme || 'dark';
                const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                const nextSettings = { ...getGeneralUiSettings(), appTheme: nextTheme as 'dark' | 'light' };
                setUiSettings(nextSettings);
                saveGeneralUiSettings(nextSettings);
              }}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title={
                (uiSettings.appTheme || 'dark') === 'dark'
                  ? 'Switch to Soft Dark Gray Theme (Glare-Free)'
                  : 'Switch to Midnight Obsidian Dark Theme'
              }
            >
              {(uiSettings.appTheme || 'dark') === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-sky-400" />
              )}
            </button>

            {/* Collapse Sidebar Button */}
            <button
              onClick={toggleSidebarCollapse}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Collapse Left Sidebar (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Quick Dashboard Overview Navigation Button */}
        <div className="px-3 pt-2.5">
          <button
            onClick={handleOpenDashboard}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab?.type === 'dashboard'
                ? 'bg-sky-600/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-300 hover:bg-slate-900 hover:text-white border border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-sky-400" />
              <span>Dashboard & Overview</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 focus-within:border-sky-500">
            <Search className="w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search profiles or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none w-full"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 px-3 py-2 text-xs">
          <button
            onClick={() => { setEditingProfile(null); setShowProfileModal(true); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </button>
          <button
            onClick={handleCreateFolder}
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
            title="Create Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowImportExport(true)}
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
            title="Import / Export"
          >
            <FileUp className="w-4 h-4" />
          </button>
        </div>

        {/* Profile List & Folders */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1 text-xs">
          {/* Folders */}
          {folders.map((folder) => {
            const folderProfs = filteredProfiles.filter((p) => p.folder_id === folder.id);
            const isExpanded = expandedFolders[folder.id] !== false;
            const isDragOver = dragOverFolderId === folder.id;

            return (
              <div key={folder.id} className="space-y-0.5">
                <FolderSidebarRow
                  folder={folder}
                  folderProfs={folderProfs}
                  isExpanded={isExpanded}
                  isDragOver={isDragOver}
                  onToggle={() => toggleFolder(folder.id)}
                  onNewProfileHere={() => handleNewProfileInFolder(folder.id)}
                  onRename={() => handleRenameFolder(folder)}
                  onDelete={() => handleDeleteFolder(folder.id, folder.name)}
                  onCollapseAll={collapseAllFolders}
                  onExpandAll={expandAllFolders}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverFolderId !== folder.id) {
                      setDragOverFolderId(folder.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragOverFolderId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const profId = e.dataTransfer.getData('text/plain') || draggedProfileId;
                    if (profId) {
                      handleMoveProfileToFolder(profId, folder.id);
                    }
                    setDraggedProfileId(null);
                    setDragOverFolderId(null);
                  }}
                />

                {isExpanded && (
                  <div className="pl-4 space-y-0.5">
                    {folderProfs.map((prof) => (
                      <ProfileSidebarItem
                        key={prof.id}
                        profile={prof}
                        folders={folders}
                        isDragging={draggedProfileId === prof.id}
                        reachabilityStatus={hostStatusMap[prof.id] || 'unknown'}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', prof.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedProfileId(prof.id);
                        }}
                        onDragEnd={() => {
                          setDraggedProfileId(null);
                          setDragOverFolderId(null);
                        }}
                        onConnectTerminal={() => handleOpenTerminal(prof)}
                        onOpenSFTP={() => handleOpenSFTP(prof)}
                        onOpenNotes={() => setViewingNotesProfile(prof)}
                        onEdit={() => { setEditingProfile(prof); setShowProfileModal(true); }}
                        onDelete={() => handleDeleteProfile(prof.id)}
                        onMoveToFolder={(targetFolderId) => handleMoveProfileToFolder(prof.id, targetFolderId)}
                        onDuplicate={() => handleDuplicateProfile(prof)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Root profiles */}
          {filteredProfiles
            .filter((p) => !p.folder_id)
            .map((prof) => (
              <ProfileSidebarItem
                key={prof.id}
                profile={prof}
                folders={folders}
                isDragging={draggedProfileId === prof.id}
                reachabilityStatus={hostStatusMap[prof.id] || 'unknown'}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', prof.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedProfileId(prof.id);
                }}
                onDragEnd={() => {
                  setDraggedProfileId(null);
                  setDragOverFolderId(null);
                }}
                onConnectTerminal={() => handleOpenTerminal(prof)}
                onOpenSFTP={() => handleOpenSFTP(prof)}
                onOpenNotes={() => setViewingNotesProfile(prof)}
                onEdit={() => { setEditingProfile(prof); setShowProfileModal(true); }}
                onDelete={() => handleDeleteProfile(prof.id)}
                onMoveToFolder={(targetFolderId) => handleMoveProfileToFolder(prof.id, targetFolderId)}
                onDuplicate={() => handleDuplicateProfile(prof)}
              />
            ))}

          {/* Dedicated drop zone to move to root / unorganized when dragging */}
          {draggedProfileId && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                setDragOverFolderId('root');
              }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const profId = e.dataTransfer.getData('text/plain') || draggedProfileId;
                if (profId) {
                  handleMoveProfileToFolder(profId, null);
                }
                setDraggedProfileId(null);
                setDragOverFolderId(null);
              }}
              className={`p-2.5 mt-2 rounded-lg border-2 border-dashed text-center transition cursor-pointer text-xs font-semibold ${
                dragOverFolderId === 'root'
                  ? 'border-sky-400 bg-sky-500/25 text-sky-200 ring-2 ring-sky-500/40 shadow-sm'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                <FolderMinus className="w-3.5 h-3.5 text-slate-400" />
                <span>Drop here to move to Root (No Folder)</span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Categorized Navigation Sections */}
        <div className="border-t border-slate-800/80 bg-slate-950/90 text-xs overflow-y-auto max-h-[50vh] divide-y divide-slate-800/40 select-none">
          {/* SECTION 1: FLEET & AUTOMATION */}
          <div className="p-1.5">
            <button
              onClick={() => toggleNavSection('automation')}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold tracking-wider text-slate-400 hover:text-slate-200 uppercase transition rounded hover:bg-slate-900/60"
            >
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Fleet & Automation</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  collapsedNavSections['automation'] ? '-rotate-90' : ''
                }`}
              />
            </button>

            {!collapsedNavSections['automation'] && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => {
                    const tab = { id: 'tab-ansible', type: 'ansible' as const, title: 'Ansible Fleet Hub' };
                    if (!tabs.some((t) => t.id === 'tab-ansible')) setTabs([...tabs, tab]);
                    setActiveTabId('tab-ansible');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition ${
                    activeTab?.type === 'ansible'
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Ansible Automation</span>
                </button>

                <button
                  onClick={() => setShowRunbookRunner(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <PlaySquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Fleet Runbooks</span>
                </button>

                <button
                  onClick={() => setShowConfigDrift(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <GitCompare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Configuration Drift</span>
                </button>

                <button
                  onClick={() => setShowBatchPush(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Fleet File Push</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: SECURITY & COMPLIANCE */}
          <div className="p-1.5">
            <button
              onClick={() => toggleNavSection('security')}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold tracking-wider text-slate-400 hover:text-slate-200 uppercase transition rounded hover:bg-slate-900/60"
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Security & Trust</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  collapsedNavSections['security'] ? '-rotate-90' : ''
                }`}
              />
            </button>

            {!collapsedNavSections['security'] && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => {
                    const tab = { id: 'tab-trust', type: 'trust' as const, title: 'Host Trust Store' };
                    if (!tabs.some((t) => t.id === 'tab-trust')) setTabs([...tabs, tab]);
                    setActiveTabId('tab-trust');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition ${
                    activeTab?.type === 'trust'
                      ? 'bg-emerald-600/20 text-emerald-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Host Trust Store</span>
                </button>

                <button
                  onClick={() => {
                    const tab = { id: 'tab-audit', type: 'audit' as const, title: 'ISO 27001 Audit Logs' };
                    if (!tabs.some((t) => t.id === 'tab-audit')) setTabs([...tabs, tab]);
                    setActiveTabId('tab-audit');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition ${
                    activeTab?.type === 'audit'
                      ? 'bg-sky-600/20 text-sky-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Cryptographic Audit Log</span>
                </button>

                <button
                  onClick={() => setShowBreakGlass(true)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition cursor-pointer ${
                    breakGlassGrant
                      ? 'bg-red-950/40 border border-red-500/40 text-red-200 font-semibold animate-pulse'
                      : 'text-slate-400 hover:bg-red-950/30 hover:text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Flame className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="truncate">JIT Break-Glass Access</span>
                  </div>
                  {breakGlassGrant && (
                    <span className="text-[9px] bg-red-500 text-white font-mono px-1.5 py-0.2 rounded font-bold uppercase">
                      Active
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setShowKeyDeploy(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">SSH Key Deployer</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 3: TOOLBOX & CONNECTIVITY */}
          <div className="p-1.5">
            <button
              onClick={() => toggleNavSection('tools')}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold tracking-wider text-slate-400 hover:text-slate-200 uppercase transition rounded hover:bg-slate-900/60"
            >
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Toolbox & Access</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  collapsedNavSections['tools'] ? '-rotate-90' : ''
                }`}
              />
            </button>

            {!collapsedNavSections['tools'] && (
              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => {
                    const tab = { id: 'tab-vault', type: 'vault' as const, title: 'Password Vault' };
                    if (!tabs.some((t) => t.id === 'tab-vault')) setTabs([...tabs, tab]);
                    setActiveTabId('tab-vault');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition ${
                    activeTab?.type === 'vault'
                      ? 'bg-amber-600/20 text-amber-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Password Vault</span>
                </button>

                <button
                  onClick={() => {
                    const tab = { id: 'tab-tunnels', type: 'tunnels' as const, title: 'Port Forwarding & Tunnels' };
                    if (!tabs.some((t) => t.id === 'tab-tunnels')) setTabs([...tabs, tab]);
                    setActiveTabId('tab-tunnels');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition cursor-pointer ${
                    activeTab?.type === 'tunnels'
                      ? 'bg-purple-600/20 text-purple-300 font-semibold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Network className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Port Tunnels</span>
                </button>

                <button
                  onClick={() => setShowGlobalSnippets(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Snippets & Commands</span>
                </button>

                <button
                  onClick={() => setShowGlobalKeyGen(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">SSH Key Generator</span>
                </button>

                <button
                  onClick={() => setShowUptimeMonitor(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Uptime & Latency Monitor</span>
                </button>

                <button
                  onClick={() => setShowCloudImport(true)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition text-slate-400 hover:bg-slate-900 hover:text-slate-200 cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Cloud Provider Importer</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Persistent Bottom Settings Bar */}
        <div className="p-2 border-t border-slate-800/80 bg-slate-950 shrink-0">
          <button
            onClick={() => {
              const tab = { id: 'tab-settings', type: 'settings' as const, title: 'Governance & Settings' };
              if (!tabs.some((t) => t.id === 'tab-settings')) setTabs([...tabs, tab]);
              setActiveTabId('tab-settings');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition cursor-pointer ${
              activeTab?.type === 'settings'
                ? 'bg-purple-600/20 text-purple-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium">Settings & Diagnostics</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
          </button>

          <div className="mt-1 pt-1 border-t border-slate-900">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition text-xs cursor-pointer group"
              title="Lock Workstation & Sign Out (Requires Master Password / Google MFA to Unlock)"
            >
              <div className="flex items-center gap-2.5">
                <LogOut className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">Lock Workstation</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Log Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Draggable Sidebar Resizer / Splitter Bar */}
      {!isSidebarCollapsed && (
        <div
          onMouseDown={handleStartSidebarDrag}
          onDoubleClick={() => {
            // Double-click to reset to default 260px width
            const nextSettings = { ...getGeneralUiSettings(), sidebarWidth: 260 };
            setUiSettings(nextSettings);
            saveGeneralUiSettings(nextSettings);
          }}
          title="Drag to resize sidebar • Double-click to reset to default (260px)"
          className={`relative z-20 w-1.5 hover:w-2 shrink-0 cursor-col-resize select-none flex items-center justify-center transition-all group ${
            isDraggingSidebar
              ? 'bg-sky-500 w-2 ring-2 ring-sky-400/40'
              : 'bg-transparent hover:bg-sky-500/40'
          }`}
        >
          {/* Subtle visual grip handle line */}
          <div
            className={`h-8 w-[3px] rounded-full transition-all ${
              isDraggingSidebar
                ? 'bg-white opacity-100'
                : 'bg-slate-700/80 group-hover:bg-sky-400 group-hover:h-12 opacity-0 group-hover:opacity-100'
            }`}
          />
        </div>
      )}

      {/* Main Workspace & Tabs */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Tab Bar */}
        <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center px-2 gap-1 shrink-0 relative z-30">
          {/* Expand Sidebar Toggle (shown when collapsed) */}
          {isSidebarCollapsed && (
            <button
              onClick={toggleSidebarCollapse}
              className="flex items-center gap-1.5 px-2.5 py-1 mr-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer shrink-0 shadow-sm group"
              title="Expand Left Sidebar (Ctrl+B)"
            >
              <PanelLeftOpen className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Sidebar</span>
            </button>
          )}

          {/* Horizontally Scrollable Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto min-w-0 h-full py-0.5 shrink">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const accentBorder = {
                sky: 'border-sky-500',
                indigo: 'border-indigo-500',
                emerald: 'border-emerald-500',
                rose: 'border-rose-500',
                amber: 'border-amber-500',
                cyan: 'border-cyan-500'
              }[uiSettings.accentColor] || 'border-sky-500';

              const tabClass = uiSettings.tabStyle === 'modern'
                ? `flex items-center gap-2 px-3 py-1 rounded-lg border text-xs cursor-pointer select-none transition my-1 mx-0.5 shrink-0 ${
                    isActive
                      ? `bg-slate-800 text-white font-semibold ${accentBorder} shadow-md`
                      : 'bg-slate-950/40 text-slate-400 border-slate-800/80 hover:bg-slate-900 hover:text-slate-200'
                  }`
                : uiSettings.tabStyle === 'minimal'
                ? `flex items-center gap-2 px-3 py-2 border-b-2 text-xs cursor-pointer select-none transition bg-transparent shrink-0 ${
                    isActive
                      ? `text-white font-semibold ${accentBorder}`
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`
                : `flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t-2 select-none transition shrink-0 ${
                    isActive
                      ? `bg-[#090d16] text-white ${accentBorder} font-semibold`
                      : 'bg-slate-900/40 text-slate-400 border-transparent hover:bg-slate-900 hover:text-slate-200'
                  }`;

              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={tabClass}
                >
                  {tab.type === 'dashboard' && <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />}
                  {tab.type === 'terminal' && (
                    tab.profile?.id === 'local-wsl' ? (
                      <HardDrive className="w-3.5 h-3.5 text-emerald-400" title="WSL2 Linux Shell" />
                    ) : tab.profile?.id === 'local-cmd' ? (
                      <Code className="w-3.5 h-3.5 text-amber-400" title="Command Prompt" />
                    ) : tab.profile?.id?.startsWith('local-') ? (
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" title="PowerShell Terminal" />
                    ) : tab.profile?.os_flavor ? (
                      <DistroIcon flavor={tab.profile.os_flavor} className="w-3.5 h-3.5" title={tab.profile.os_name || tab.profile.os_flavor} />
                    ) : (
                      <Terminal className="w-3.5 h-3.5 text-sky-400" title="SSH Terminal" />
                    )
                  )}
                  {tab.type === 'sftp' && <HardDrive className="w-3.5 h-3.5 text-emerald-400" />}
                  {tab.type === 'ansible' && <Sliders className="w-3.5 h-3.5 text-indigo-400" />}
                  {tab.type === 'trust' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                  {tab.type === 'audit' && <Lock className="w-3.5 h-3.5 text-sky-400" />}
                  {tab.type === 'vault' && <Key className="w-3.5 h-3.5 text-amber-400" />}
                  {tab.type === 'tunnels' && <Network className="w-3.5 h-3.5 text-purple-400" />}
                  {tab.type === 'settings' && <Settings className="w-3.5 h-3.5 text-purple-400" />}

                  <span className="truncate max-w-[160px]">{tab.title}</span>

                  {tab.type !== 'dashboard' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* New Tab Dropdown (+) for Local Shells & Remote SSH */}
          <div className="relative shrink-0 my-1 mx-0.5 z-40" ref={newTabDropdownRef}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNewTabDropdown((prev) => !prev);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/60 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer shadow-md group"
              title="Open New Tab (Local Terminal or Remote Host)"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <ChevronDown className="w-2.5 h-2.5 text-slate-400 group-hover:text-slate-200" />
            </button>

            {showNewTabDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-2 w-64 bg-[#0d1527] border border-slate-700 rounded-xl shadow-2xl py-1 text-xs text-slate-200 z-[9999] pointer-events-auto select-none"
              >
                <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Local System Shells</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-800/60 font-mono">PTY</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenLocalTerminal('powershell');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-sky-300 transition cursor-pointer group"
                >
                  <Terminal className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-semibold text-slate-200">PowerShell</div>
                    <div className="text-[10px] text-slate-400">Windows PowerShell terminal</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenLocalTerminal('wsl');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-emerald-300 transition cursor-pointer group"
                >
                  <HardDrive className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-semibold text-slate-200">WSL2 (Linux)</div>
                    <div className="text-[10px] text-slate-400">Windows Subsystem for Linux</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenLocalTerminal('cmd');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-amber-300 transition cursor-pointer group"
                >
                  <Code className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-semibold text-slate-200">Command Prompt</div>
                    <div className="text-[10px] text-slate-400">Standard cmd.exe shell</div>
                  </div>
                </button>

                <div className="h-px bg-slate-800 my-1" />

                <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Remote Fleet</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono">SSH</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewTabDropdown(false);
                    setEditingProfile(null);
                    setShowProfileModal(true);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-indigo-300 transition cursor-pointer group"
                >
                  <Server className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-semibold text-slate-200">New SSH Server Profile</div>
                    <div className="text-[10px] text-slate-400">Configure host connection</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Active JIT Break-Glass Indicator & Fleet Tools */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-2">
            {breakGlassGrant && (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-950/90 border border-red-500/70 text-red-200 text-xs font-bold animate-pulse shadow-md shadow-red-950/60">
                <Flame className="w-3.5 h-3.5 text-red-400 fill-current" />
                <span>JIT: {breakGlassGrant.incidentTicketId}</span>
                <span className="text-[10px] text-red-300 font-mono">
                  ({Math.max(1, Math.round((breakGlassGrant.expiresAt - Date.now()) / 60000))}m)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBreakGlassGrant(null);
                    localStorage.removeItem('dgodterm_breakglass_grant');
                  }}
                  className="ml-1 text-red-400 hover:text-white cursor-pointer"
                  title="Revoke JIT Elevation Now"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Consolidated Fleet Operations Dropdown Menu */}
            <div className="relative shrink-0 z-40" ref={fleetDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowFleetDropdown((prev) => !prev);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/60 text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer shadow-md group"
                title="Fleet Automation, Configuration Drift, JIT & Deployment Tools"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>Fleet Ops</span>
                <ChevronDown className="w-2.5 h-2.5 text-slate-400 group-hover:text-slate-200" />
              </button>

              {showFleetDropdown && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 w-64 bg-[#0d1527] border border-slate-700 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 z-[9999] pointer-events-auto select-none"
                >
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Automation & Governance</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono">ENTERPRISE</span>
                  </div>

                  <button
                    onClick={() => { setShowConfigDrift(true); setShowFleetDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-cyan-300 transition cursor-pointer"
                  >
                    <GitCompare className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Configuration Drift</div>
                      <div className="text-[10px] text-slate-400">Multi-host diff comparator</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowRunbookRunner(true); setShowFleetDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-amber-300 transition cursor-pointer"
                  >
                    <PlaySquare className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Parameterized Runbooks</div>
                      <div className="text-[10px] text-slate-400">Canary rollout & playbooks</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowBreakGlass(true); setShowFleetDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-red-950/40 hover:text-red-300 transition cursor-pointer"
                  >
                    <Flame className="w-4 h-4 text-red-400" />
                    <div>
                      <div className="font-semibold text-slate-200">JIT Break-Glass Access</div>
                      <div className="text-[10px] text-slate-400">Emergency time-bound elevation</div>
                    </div>
                  </button>

                  <div className="h-px bg-slate-800 my-1" />

                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Fleet Tools & Deployment
                  </div>

                  <button
                    onClick={() => { setShowBatchPush(true); setShowFleetDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-sky-300 transition cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Batch Command / Push</div>
                      <div className="text-[10px] text-slate-400">Parallel command broadcast</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowKeyDeploy(true); setShowFleetDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-emerald-300 transition cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-slate-200">SSH Key Deployer</div>
                      <div className="text-[10px] text-slate-400">Push public keys to servers</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowUptimeMonitor(true); setShowFleetDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-emerald-300 transition cursor-pointer"
                  >
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Fleet Uptime Monitor</div>
                      <div className="text-[10px] text-slate-400">Real-time health pings & stats</div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowCloudImport(true); setShowFleetDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2.5 hover:bg-slate-800/90 hover:text-purple-300 transition cursor-pointer"
                  >
                    <Cloud className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Cloud Sync & Import</div>
                      <div className="text-[10px] text-slate-400">AWS EC2, GCP, Azure VMs</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="h-4 w-px bg-slate-800 mx-0.5" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 text-xs font-medium transition cursor-pointer"
              title="Lock Workstation & Sign Out (Requires Master Password / Google MFA to Unlock)"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Lock / Logout</span>
            </button>
          </div>
        </div>

        {/* Multi-Host Broadcast Input Bar */}
        {(() => {
          const terminalTabs = tabs.filter((t) => t.type === 'terminal' && t.sessionId && t.profile);
          const activeSessions: ActiveSessionDescriptor[] = terminalTabs.map((t) => ({
            sessionId: t.sessionId!,
            profile: t.profile!
          }));
          const currentTerminalTab = tabs.find((t) => t.id === activeTabId && t.type === 'terminal');
          const curSid = currentTerminalTab?.sessionId || (activeSessions[0]?.sessionId || '');

          if (activeSessions.length > 0) {
            return (
              <BroadcastBar
                activeSessions={activeSessions}
                currentSessionId={curSid}
                isBroadcasting={isBroadcasting}
                setIsBroadcasting={setIsBroadcasting}
                onBroadcastData={(targetIds, data) => {
                  if ((window as any).dgodterm?.broadcastSSH) {
                    (window as any).dgodterm.broadcastSSH(targetIds, data);
                  }
                }}
              />
            );
          }
          return null;
        })()}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-hidden relative bg-gradient-to-br from-[#060a14] via-[#090d16] to-[#0f172a]">
          {tabs.map((tab) => {
            if (tab.type !== 'terminal' || !tab.sessionId || !tab.profile) return null;
            const isVisible = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className="w-full h-full flex flex-col min-h-0 overflow-hidden"
                style={{ display: isVisible ? 'flex' : 'none' }}
              >
                <TerminalView
                  sessionId={tab.sessionId}
                  profile={tab.profile}
                  isActive={isVisible}
                  initialCommand={tab.initialCommand}
                  onClose={() => handleCloseTab(tab.id)}
                  onRequestPassword={(sid, prof) => {
                    setPendingPasswordPrompt({
                      sessionId: sid,
                      profile: prof,
                      targetType: 'terminal',
                      promptText: `Enter SSH password for ${prof.username}@${prof.hostname}:`
                    });
                  }}
                />
              </div>
            );
          })}

          {tabs.map((tab) => {
            if (tab.type !== 'sftp' || !tab.sessionId || !tab.profile) return null;
            const isVisible = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className="w-full h-full flex flex-col min-h-0 overflow-hidden"
                style={{ display: isVisible ? 'flex' : 'none' }}
              >
                <SftpView
                  sessionId={tab.sessionId}
                  profile={tab.profile}
                />
              </div>
            );
          })}

          {/* Dashboard Landing Page View */}
          <div style={{ display: (activeTab?.type === 'dashboard' || !activeTab) ? 'block' : 'none', height: '100%', overflow: 'hidden' }}>
            <DashboardView
              profiles={profiles}
              activeSessionsCount={tabs.filter((t) => (t.type === 'terminal' || t.type === 'sftp') && t.sessionId).length}
              hostStatusMap={hostStatusMap}
              hostUptimeMap={hostUptimeMap}
              activeTabs={tabs}
              onOpenTerminal={handleOpenTerminal}
              onOpenSftp={handleOpenSFTP}
              onOpenNotes={(prof) => setViewingNotesProfile(prof)}
              onNewProfile={() => { setEditingProfile(null); setShowProfileModal(true); }}
              onImportHosts={() => setShowImportExport(true)}
              onNavigateTab={(targetTab) => {
                const titles: Record<string, string> = {
                  ansible: 'Ansible Fleet Automation',
                  audit: 'ISO 27001 Audit Logs',
                  trust: 'Host Trust Store',
                  settings: 'Governance & Settings',
                  vault: 'Password Vault',
                  tunnels: 'SSH Tunnels'
                };
                const existing = tabs.find((t) => t.type === targetTab);
                if (existing) {
                  setActiveTabId(existing.id);
                } else {
                  const newTab: TabItem = {
                    id: `tab-${targetTab}`,
                    type: targetTab,
                    title: titles[targetTab] || targetTab
                  };
                  setTabs((prev) => [...prev, newTab]);
                  setActiveTabId(newTab.id);
                }
              }}
              onOpenModal={(modalName) => {
                if (modalName === 'drift') setShowConfigDrift(true);
                if (modalName === 'runbooks') setShowRunbookRunner(true);
                if (modalName === 'breakglass') setShowBreakGlass(true);
                if (modalName === 'keygen') setShowGlobalKeyGen(true);
                if (modalName === 'snippets') setShowGlobalSnippets(true);
                if (modalName === 'batchpush') setShowBatchPush(true);
                if (modalName === 'keydeploy') setShowKeyDeploy(true);
                if (modalName === 'uptime') setShowUptimeMonitor(true);
                if (modalName === 'cloudimport') setShowCloudImport(true);
              }}
            />
          </div>

          <div style={{ display: activeTab?.type === 'ansible' ? 'block' : 'none', height: '100%' }}>
            <AnsibleView />
          </div>
          <div style={{ display: activeTab?.type === 'trust' ? 'block' : 'none', height: '100%' }}>
            <TrustStoreView />
          </div>
          <div style={{ display: activeTab?.type === 'audit' ? 'block' : 'none', height: '100%' }}>
            <AuditView />
          </div>
          <div style={{ display: activeTab?.type === 'vault' ? 'block' : 'none', height: '100%' }}>
            <PasswordVaultView />
          </div>
          <div style={{ display: activeTab?.type === 'tunnels' ? 'block' : 'none', height: '100%' }}>
            <TunnelManagerView />
          </div>
          <div style={{ display: activeTab?.type === 'settings' ? 'block' : 'none', height: '100%' }}>
            <SettingsView />
          </div>
        </div>

        {/* Global Security Status Bar */}
        {uiSettings.showStatusBar && (
          <div className="h-6.5 bg-slate-950 border-t border-slate-800/80 px-3 flex items-center justify-between text-[11px] text-slate-500 select-none shrink-0 font-mono whitespace-nowrap overflow-x-auto overflow-y-hidden gap-2">
            {/* Left: Security & Governance */}
            <div className="flex items-center gap-2 lg:gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap" title="Host Key & Identity Policy: Strict Verification Active">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden 2xl:inline">Strict Host Verification:</span>
                <span className="hidden sm:inline 2xl:hidden">Host:</span>
                <span className="text-emerald-400 font-medium">Active</span>
              </span>

              <span className="text-slate-700 hidden sm:inline">•</span>

              <span className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap" title="Cryptographic SHA-256 Hash Chain Integrity Verification">
                <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="hidden 2xl:inline">Audit Integrity Chain:</span>
                <span className="hidden md:inline 2xl:hidden">Audit:</span>
                <span className="text-sky-300 font-medium">SHA-256</span>
              </span>

              <span className="text-slate-700 hidden lg:inline">•</span>

              <span className="hidden lg:flex items-center gap-1.5 text-slate-400 whitespace-nowrap" title="Automatic Credentials & Secret Redaction Engine">
                <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden 2xl:inline">Secret Redactor:</span>
                <span className="hidden xl:inline 2xl:hidden">Redactor:</span>
                <span className="text-emerald-400 font-medium">ACTIVE</span>
              </span>
            </div>

            {/* Center: Live Host Resource Telemetry */}
            {hostResources && (
              <div className="flex items-center gap-2 lg:gap-3 text-slate-400 shrink-0 px-2">
                <span className="flex items-center gap-1.5 whitespace-nowrap" title="Host CPU Utilization">
                  <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    CPU:{' '}
                    <strong className={hostResources.cpuPercent > 80 ? 'text-rose-400 font-semibold' : 'text-slate-200 font-medium'}>
                      {hostResources.cpuPercent}%
                    </strong>
                  </span>
                </span>

                <span className="text-slate-700 hidden sm:inline">•</span>

                <span className="flex items-center gap-1.5 whitespace-nowrap" title={`Host Physical RAM Usage: ${hostResources.ramUsedGB}/${hostResources.ramTotalGB} GB (${hostResources.ramPercent}%)`}>
                  <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    RAM:{' '}
                    <strong className={hostResources.ramPercent > 80 ? 'text-amber-400 font-semibold' : 'text-slate-200 font-medium'}>
                      <span className="hidden 2xl:inline">{hostResources.ramUsedGB}/{hostResources.ramTotalGB} GB </span>
                      ({hostResources.ramPercent}%)
                    </strong>
                  </span>
                </span>

                <span className="text-slate-700 hidden sm:inline">•</span>

                <span className="flex items-center gap-1.5 whitespace-nowrap" title={`Host Primary Disk Usage: ${hostResources.diskUsedGB}/${hostResources.diskTotalGB} GB (${hostResources.diskPercent}%)`}>
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Disk:{' '}
                    <strong className={hostResources.diskPercent > 85 ? 'text-rose-400 font-semibold' : 'text-slate-200 font-medium'}>
                      <span className="hidden 2xl:inline">{hostResources.diskUsedGB}/{hostResources.diskTotalGB} GB </span>
                      ({hostResources.diskPercent}%)
                    </strong>
                  </span>
                </span>
              </div>
            )}

            {/* Right: Version & Standard */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0 text-slate-500 whitespace-nowrap">
              <span>DgodTerm v1.0.0</span>
              <span className="hidden xl:inline text-slate-600">(ISO/IEC 27001 Aligned)</span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showProfileModal && (
        <ProfileEditModal
          initialProfile={editingProfile}
          folders={folders}
          onSave={async (prof) => {
            await (window as any).dgodterm.saveProfile(prof);
            setShowProfileModal(false);
            loadData();
          }}
          onCancel={() => setShowProfileModal(false)}
        />
      )}

      {viewingNotesProfile && (
        <HostNotesModal
          profile={viewingNotesProfile}
          folders={folders}
          onSave={async (updatedProfile) => {
            await (window as any).dgodterm.saveProfile(updatedProfile);
            setViewingNotesProfile(updatedProfile);
            loadData();
          }}
          onClose={() => setViewingNotesProfile(null)}
          onConnectTerminal={() => handleOpenTerminal(viewingNotesProfile)}
        />
      )}

      {showImportExport && (
        <ImportExportModal
          folders={folders}
          onClose={() => setShowImportExport(false)}
          onRefreshProfiles={loadData}
        />
      )}

      {pendingHostPrompt && (
        <HostVerificationModal
          promptData={pendingHostPrompt}
          onResolve={handleHostVerificationResolve}
        />
      )}

      {pendingPasswordPrompt && (
        <PasswordPromptModal
          profile={pendingPasswordPrompt.profile}
          promptText={pendingPasswordPrompt.promptText}
          onSubmit={handlePasswordSubmit}
          onCancel={() => setPendingPasswordPrompt(null)}
        />
      )}

      {/* Global Snippets Palette Modal */}
      {showGlobalSnippets && (
        <SnippetsModal
          onClose={() => setShowGlobalSnippets(false)}
          availableSessions={tabs
            .filter((t) => t.type === 'terminal' && t.sessionId)
            .map((t) => ({
              id: t.id,
              sessionId: t.sessionId!,
              title: t.title
            }))}
          activeSessionId={tabs.find((t) => t.id === activeTabId && t.type === 'terminal')?.sessionId}
          profiles={profiles}
          onConnectAndExecute={(profile, cmd) => {
            handleOpenTerminal(profile, cmd);
          }}
          onExecuteSnippet={(cmd, targetSessionId) => {
            let targetTab = tabs.find((t) => t.sessionId === targetSessionId || t.id === targetSessionId);
            if (!targetTab || targetTab.type !== 'terminal') {
              const currentTab = tabs.find((t) => t.id === activeTabId);
              if (currentTab?.type === 'terminal' && currentTab.sessionId) {
                targetTab = currentTab;
              } else {
                targetTab = tabs.slice().reverse().find((t) => t.type === 'terminal' && t.sessionId);
              }
            }

            if (targetTab && targetTab.type === 'terminal' && targetTab.sessionId) {
              setActiveTabId(targetTab.id);
              (window as any).dgodterm?.sendSSHData?.(targetTab.sessionId, cmd + '\n');
            }
          }}
        />
      )}

      {/* Global SSH Key Pair Generator Modal */}
      {showGlobalKeyGen && (
        <SSHKeyGeneratorModal
          onClose={() => setShowGlobalKeyGen(false)}
        />
      )}

      {/* Multi-Host Configuration Drift Modal */}
      {showConfigDrift && (
        <ConfigDriftModal
          profiles={profiles}
          onClose={() => setShowConfigDrift(false)}
        />
      )}

      {/* Corporate Fleet Runbook Runner Modal */}
      {showRunbookRunner && (
        <RunbookRunnerModal
          profiles={profiles}
          onClose={() => setShowRunbookRunner(false)}
        />
      )}

      {/* Just-In-Time (JIT) Break-Glass Emergency Escalation Modal */}
      {showBreakGlass && (
        <BreakGlassModal
          profiles={profiles}
          onClose={() => setShowBreakGlass(false)}
          onGranted={(grant) => {
            setBreakGlassGrant(grant);
            localStorage.setItem('dgodterm_breakglass_grant', JSON.stringify(grant));
          }}
        />
      )}

      {/* Fleet Batch File Push & Diff Modal */}
      {showBatchPush && (
        <BatchPushModal
          profiles={profiles}
          onClose={() => setShowBatchPush(false)}
        />
      )}

      {/* 1-Click SSH Public Key Deployer Modal */}
      {showKeyDeploy && (
        <KeyDeployModal
          profiles={profiles}
          onClose={() => setShowKeyDeploy(false)}
        />
      )}

      {/* Automated Uptime & Latency Monitor Panel */}
      {showUptimeMonitor && (
        <UptimeMonitorPanel
          onClose={() => setShowUptimeMonitor(false)}
          onConnect={(profileId) => {
            const prof = profiles.find((p) => p.id === profileId);
            if (prof) {
              handleOpenTerminal(prof);
              setShowUptimeMonitor(false);
            }
          }}
        />
      )}

      {/* Multi-Cloud Provider VM Importer Modal */}
      {showCloudImport && (
        <CloudImportModal
          onClose={() => setShowCloudImport(false)}
          onImported={() => {
            loadData();
            setShowCloudImport(false);
          }}
        />
      )}

      {/* Enterprise App Login & Google MFA Modal */}
      {(!isAuthenticated || isLocked) && (
        <AppLoginModal
          onAuthenticated={() => {
            try {
              sessionStorage.setItem('dgodterm_session_auth', 'true');
            } catch {}
            setIsAuthenticated(true);
            setIsLocked(false);
            lastActiveTimeRef.current = Date.now();
          }}
        />
      )}
    </div>
  );
};

interface FolderSidebarRowProps {
  folder: Folder;
  folderProfs: ConnectionProfile[];
  isExpanded: boolean;
  isDragOver: boolean;
  onToggle: () => void;
  onNewProfileHere: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const FolderSidebarRow: React.FC<FolderSidebarRowProps> = ({
  folder,
  folderProfs,
  isExpanded,
  isDragOver,
  onToggle,
  onNewProfileHere,
  onRename,
  onDelete,
  onCollapseAll,
  onExpandAll,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const handleOpenMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.right - 210, y: rect.bottom + 4 });
    setMenuOpen(!menuOpen);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onContextMenu={handleContextMenu}
        className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer font-medium transition select-none ${
          isDragOver
            ? 'bg-sky-500/25 text-sky-200 border border-sky-400/80 ring-2 ring-sky-500/40 shadow-sm'
            : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform shrink-0" />
          )}
          <FolderIcon className={`w-3.5 h-3.5 shrink-0 ${isDragOver ? 'text-sky-300' : 'text-amber-400/80'}`} />
          <span className="truncate">{folder.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isDragOver && (
            <span className="text-[10px] text-sky-300 font-semibold uppercase animate-pulse">
              Drop Here
            </span>
          )}
          <span className="text-[10px] text-slate-600 font-mono">{folderProfs.length}</span>

          <button
            onClick={handleOpenMenuClick}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Folder Options"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Folder Context Menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: `${Math.min(menuPos.x, window.innerWidth - 215)}px`,
            top: `${Math.min(menuPos.y, window.innerHeight - 245)}px`,
            zIndex: 9999
          }}
          className="w-52 bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-xl shadow-2xl py-1 text-xs text-slate-200 ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate font-semibold text-slate-300">
              <FolderIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{folder.name}</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
              {folderProfs.length}
            </span>
          </div>

          {/* Toggle Folder (Minimize / Expand) */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onToggle();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Collapse Folder</span>
              </>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Expand Folder</span>
              </>
            )}
          </button>

          {/* New Profile in this Folder */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onNewProfileHere();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Add Session to Folder</span>
          </button>

          {/* Rename Folder */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onRename();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Rename Folder</span>
          </button>

          <div className="my-1 border-t border-slate-800" />

          {/* Collapse All */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onCollapseAll();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition text-left"
          >
            <FolderMinus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Collapse All Folders</span>
          </button>

          {/* Expand All */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onExpandAll();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition text-left"
          >
            <FolderPlus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Expand All Folders</span>
          </button>

          <div className="my-1 border-t border-slate-800" />

          {/* Delete Folder */}
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-red-400 hover:text-red-300 cursor-pointer transition text-left"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Delete Folder</span>
          </button>
        </div>
      )}
    </div>
  );
};

interface ProfileSidebarItemProps {
  profile: ConnectionProfile;
  folders: Folder[];
  isDragging?: boolean;
  reachabilityStatus?: 'up' | 'down' | 'unknown';
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onConnectTerminal: () => void;
  onOpenSFTP: () => void;
  onOpenNotes: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveToFolder: (targetFolderId: string | null) => void;
  onDuplicate?: () => void;
}

const ProfileSidebarItem: React.FC<ProfileSidebarItemProps> = ({
  profile,
  folders,
  isDragging = false,
  reachabilityStatus = 'unknown',
  onDragStart,
  onDragEnd,
  onConnectTerminal,
  onOpenSFTP,
  onOpenNotes,
  onEdit,
  onDelete,
  onMoveToFolder,
  onDuplicate
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSubmenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSubmenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
    setSubmenuOpen(false);
  };

  const handleOpenMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.right - 220, y: rect.bottom + 4 });
    setMenuOpen(!menuOpen);
    setSubmenuOpen(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onConnectTerminal}
      onContextMenu={handleContextMenu}
      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white cursor-grab active:cursor-grabbing transition select-none ${
        isDragging
          ? 'opacity-30 bg-sky-950/40 border border-dashed border-sky-400'
          : reachabilityStatus === 'down'
          ? 'bg-red-950/20 border border-red-500/20 hover:border-red-500/50 hover:bg-red-950/30'
          : reachabilityStatus === 'up'
          ? 'hover:bg-slate-900/90 hover:border-emerald-500/30 border border-transparent'
          : 'hover:bg-slate-900/90 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 truncate pointer-events-none">
        <div className="relative shrink-0 flex items-center justify-center">
          <DistroIcon
            flavor={profile.os_flavor}
            className={`w-3.5 h-3.5 transition-colors shrink-0 ${
              !profile.os_flavor
                ? reachabilityStatus === 'down'
                  ? 'text-rose-500'
                  : reachabilityStatus === 'up'
                  ? 'text-emerald-400'
                  : 'text-sky-400/80 group-hover:text-sky-300'
                : ''
            }`}
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-slate-950 ${
              reachabilityStatus === 'down'
                ? 'bg-rose-500 shadow-sm shadow-rose-500/80'
                : reachabilityStatus === 'up'
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80'
                : 'bg-slate-500/50'
            }`}
            title={reachabilityStatus === 'down' ? 'Offline' : reachabilityStatus === 'up' ? 'Reachable' : 'Checking...'}
          />
        </div>
        <div className="truncate">
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate font-medium text-slate-200">{profile.display_name}</span>
            {profile.notes?.trim() && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNotes();
                }}
                className="p-0.5 rounded hover:bg-slate-800 text-amber-400 hover:text-amber-300 pointer-events-auto shrink-0 transition"
                title="View Host Insights & Comments"
              >
                <FileText className="w-3 h-3" />
              </span>
            )}
            {(profile.tags?.some((t) => t.toLowerCase().includes('prod')) ||
              profile.display_name.toLowerCase().includes('prod')) && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase shrink-0">
                PROD
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate flex items-center gap-1.5">
            <span>{profile.username}@{profile.hostname}</span>
            {profile.os_name && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900/90 text-slate-400 border border-slate-800 shrink-0 font-sans" title={profile.os_name}>
                {profile.os_name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenNotes();
          }}
          className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${
            profile.notes?.trim()
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-slate-400 hover:text-amber-300'
          }`}
          title="Host Insights & Comments"
        >
          <FileText className="w-3 h-3" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSFTP();
          }}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 cursor-pointer"
          title="Open SFTP"
        >
          <HardDrive className="w-3 h-3" />
        </button>

        <button
          onClick={handleOpenMenuClick}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          title="Session Actions"
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: Math.max(10, Math.min(menuPos.y, window.innerHeight - 280)),
            left: Math.max(10, Math.min(menuPos.x, window.innerWidth - 240)),
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-56 bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-xl shadow-2xl py-1 text-xs text-slate-200 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 truncate font-semibold">
            {profile.display_name}
          </div>

          <button
            onClick={() => { setMenuOpen(false); onConnectTerminal(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Connect SSH</span>
          </button>

          <button
            onClick={() => { setMenuOpen(false); onOpenSFTP(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Open SFTP Browser</span>
          </button>

          <button
            onClick={() => { setMenuOpen(false); onOpenNotes(); }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-medium">Host Notes & Comments</span>
            </div>
            {profile.notes?.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Has comments" />
            )}
          </button>

          <div className="my-1 border-t border-slate-800" />

          {/* Move to Folder */}
          <div
            className="relative"
            onMouseEnter={() => setSubmenuOpen(true)}
            onMouseLeave={() => setSubmenuOpen(false)}
          >
            <button
              onClick={() => setSubmenuOpen(!submenuOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
            >
              <div className="flex items-center gap-2">
                <FolderInput className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-medium">Move to Folder</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {submenuOpen && (
              <div
                className="absolute left-full top-0 ml-1 w-52 bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-xl shadow-2xl py-1 text-xs text-slate-200 ring-1 ring-white/10 max-h-64 overflow-y-auto"
              >
                <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800/80">
                  Select Destination
                </div>

                {/* Root Option */}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setSubmenuOpen(false);
                    onMoveToFolder(null);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left transition hover:bg-slate-800 cursor-pointer ${
                    !profile.folder_id ? 'text-sky-300 font-semibold bg-sky-950/40' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderMinus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">(No Folder / Root)</span>
                  </div>
                  {!profile.folder_id && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />}
                </button>

                {/* Folder list */}
                {folders.map((f) => {
                  const isCurrent = profile.folder_id === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setMenuOpen(false);
                        setSubmenuOpen(false);
                        onMoveToFolder(f.id);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left transition hover:bg-slate-800 cursor-pointer ${
                        isCurrent ? 'text-amber-300 font-semibold bg-amber-950/40' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FolderIcon className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-slate-800" />

          <button
            onClick={() => { setMenuOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Edit Profile</span>
          </button>

          {onDuplicate && (
            <button
              onClick={() => { setMenuOpen(false); onDuplicate(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-slate-200 cursor-pointer transition text-left"
            >
              <Copy className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Duplicate Profile</span>
            </button>
          )}

          <button
            onClick={() => { setMenuOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-red-400 hover:text-red-300 cursor-pointer transition text-left"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Delete Profile</span>
          </button>
        </div>
      )}
    </div>
  );
};

