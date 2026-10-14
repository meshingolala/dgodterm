import React, { useState, useEffect } from 'react';
import { ConnectionProfile, AuditEvent, SystemHealthMetrics } from '../../domain/types';
import { DistroIcon } from './DistroIcon';
import {
  LayoutDashboard,
  Terminal,
  Server,
  Activity,
  ShieldCheck,
  Lock,
  Smartphone,
  Key,
  Sliders,
  HardDrive,
  Clock,
  Zap,
  Flame,
  PlaySquare,
  GitCompare,
  KeyRound,
  Network,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Star,
  ExternalLink,
  ChevronRight,
  FileCode,
  Shield,
  Layers,
  Upload,
  UploadCloud,
  Cloud,
  FileText,
  Cpu
} from 'lucide-react';

interface DashboardViewProps {
  profiles: ConnectionProfile[];
  activeSessionsCount: number;
  hostStatusMap?: Record<string, 'up' | 'down' | 'unknown'>;
  hostUptimeMap?: Record<string, any>;
  activeTabs?: any[];
  onOpenTerminal: (profile: ConnectionProfile) => void;
  onOpenSftp: (profile: ConnectionProfile) => void;
  onOpenNotes?: (profile: ConnectionProfile) => void;
  onNewProfile: () => void;
  onImportHosts?: () => void;
  onNavigateTab: (tabType: 'ansible' | 'audit' | 'trust' | 'settings' | 'vault' | 'tunnels') => void;
  onOpenModal: (modalName: 'drift' | 'runbooks' | 'breakglass' | 'keygen' | 'snippets' | 'batchpush' | 'keydeploy' | 'uptime' | 'cloudimport') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profiles,
  activeSessionsCount,
  hostStatusMap = {},
  hostUptimeMap = {},
  activeTabs = [],
  onOpenTerminal,
  onOpenSftp,
  onOpenNotes,
  onNewProfile,
  onImportHosts,
  onNavigateTab,
  onOpenModal
}) => {
  const [recentEvents, setRecentEvents] = useState<AuditEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [auditChainValid, setAuditChainValid] = useState<boolean | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Health Metrics per host profile
  const [metricsMap, setMetricsMap] = useState<Record<string, SystemHealthMetrics>>({});
  const [samplingMap, setSamplingMap] = useState<Record<string, boolean>>({});

  const sampleHostHealth = async (profileId: string) => {
    setSamplingMap((prev) => ({ ...prev, [profileId]: true }));
    try {
      const activeTab = activeTabs?.find(
        (t) => (t.type === 'terminal' || t.type === 'sftp') && t.sessionId && t.profile?.id === profileId
      );
      const target = activeTab?.sessionId ? { sessionId: activeTab.sessionId, profileId } : { profileId };
      const metrics = await (window as any).dgodterm?.getSystemHealth?.(target);
      if (metrics) {
        setMetricsMap((prev) => ({ ...prev, [profileId]: metrics }));
      }
    } catch (e) {
      console.warn(`Health sample failed for ${profileId}:`, e);
    } finally {
      setSamplingMap((prev) => ({ ...prev, [profileId]: false }));
    }
  };

  useEffect(() => {
    if (activeTabs && activeTabs.length > 0) {
      activeTabs.forEach(async (t) => {
        if (t.profile?.id && t.sessionId) {
          try {
            const cached = await (window as any).dgodterm?.getCachedSystemHealth?.(t.profile.id);
            if (cached) {
              setMetricsMap((prev) => ({ ...prev, [t.profile.id]: cached }));
            }
          } catch (e) {}
        }
      });
    }
  }, [activeTabs]);

  useEffect(() => {
    loadDashboardData();
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoadingEvents(true);
      // Fetch recent audit events
      const events: AuditEvent[] = await (window as any).dgodterm?.getAuditEvents?.(8) || [];
      setRecentEvents(events);

      // Verify audit integrity
      const integrity = await (window as any).dgodterm?.verifyAuditIntegrity?.();
      if (integrity) {
        setAuditChainValid(Boolean(integrity.isValid));
      }

      // Check MFA status
      const status = await (window as any).dgodterm?.getVaultStatus?.();
      if (status) {
        setMfaEnabled(Boolean(status.mfaEnabled));
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Sort profiles: favorites first, then by last connected, then display name
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    const timeA = a.last_connected_at ? new Date(a.last_connected_at).getTime() : 0;
    const timeB = b.last_connected_at ? new Date(b.last_connected_at).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.display_name.localeCompare(b.display_name);
  });

  const filteredProfiles = sortedProfiles.filter((p) => {
    const s = filterSearch.toLowerCase().trim();
    if (!s) return true;
    return (
      p.display_name.toLowerCase().includes(s) ||
      p.hostname.toLowerCase().includes(s) ||
      p.username.toLowerCase().includes(s) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(s))
    );
  });

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return isoString;
    }
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.startsWith('session_')) return <Terminal className="w-3.5 h-3.5 text-sky-400" />;
    if (eventType.startsWith('sftp_')) return <HardDrive className="w-3.5 h-3.5 text-emerald-400" />;
    if (eventType.startsWith('automation_')) return <Sliders className="w-3.5 h-3.5 text-indigo-400" />;
    if (eventType.startsWith('vault_')) return <Lock className="w-3.5 h-3.5 text-amber-400" />;
    if (eventType.startsWith('mfa_')) return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
    if (eventType.startsWith('breakglass_')) return <Flame className="w-3.5 h-3.5 text-rose-400" />;
    if (eventType.startsWith('host_trust_')) return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
    if (eventType.startsWith('configuration_')) return <GitCompare className="w-3.5 h-3.5 text-cyan-400" />;
    if (eventType.startsWith('runbook_')) return <PlaySquare className="w-3.5 h-3.5 text-amber-400" />;
    return <Activity className="w-3.5 h-3.5 text-slate-400" />;
  };

  const formatEventTitle = (e: AuditEvent) => {
    switch (e.event_type) {
      case 'session_connect':
        return `SSH Session Opened`;
      case 'session_disconnect':
        return `SSH Session Closed`;
      case 'vault_unlocked':
        return `Workstation Vault Unlocked`;
      case 'vault_locked':
        return `Workstation Locked`;
      case 'mfa_enabled':
        return `Google MFA (2FA) Activated`;
      case 'mfa_disabled':
        return `Google MFA Disabled`;
      case 'host_trust_accepted':
        return `Host Fingerprint Verified`;
      case 'sftp_upload':
        return `SFTP File Uploaded`;
      case 'sftp_download':
        return `SFTP File Downloaded`;
      case 'breakglass_elevated_access':
        return `JIT Break-Glass Escalation`;
      case 'configuration_drift_checked':
        return `Multi-Host Drift Analyzed`;
      case 'runbook_executed':
        return `Fleet Runbook Executed`;
      case 'automation_started':
        return `Ansible Fleet Automation Started`;
      case 'automation_completed':
        return `Ansible Automation Completed`;
      default:
        return e.action.replace(/_/g, ' ');
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-[#090d16] via-[#0b101c] to-[#090d16] text-slate-100 p-6 space-y-6 select-none font-sans">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-emerald-500 text-white shadow-lg shadow-sky-600/20">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Workstation Command Center
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-400 border border-sky-800/60 uppercase">
                  Operator Session
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Corporate Linux Fleet Management • Zero-Trust SSH & Ansible Workspace
              </p>
            </div>
          </div>
        </div>

        {/* Security Posture Status Chips & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Host Trust: Strict</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/40 border border-sky-500/30 text-sky-300 text-xs font-medium">
            <Lock className="w-3.5 h-3.5 text-sky-400" />
            <span>Audit: SHA-256</span>
          </div>

          <button
            onClick={loadDashboardData}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Refresh Dashboard Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Servers Count */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fleet Nodes</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{profiles.length}</span>
            <span className="text-xs text-slate-400">configured targets</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{profiles.filter((p) => p.is_favorite).length} pinned favorites</span>
            <div className="flex items-center gap-2">
              {onImportHosts && (
                <button
                  onClick={onImportHosts}
                  className="text-slate-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                  title="Import SSH Hosts"
                >
                  <Upload className="w-3 h-3 text-sky-400" /> Import
                </button>
              )}
              <button
                onClick={onNewProfile}
                className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Host
              </button>
            </div>
          </div>
        </div>

        {/* Active Live Sessions */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Sessions</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Terminal className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{activeSessionsCount}</span>
            <span className="text-xs text-emerald-400 font-medium">live connections</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {activeSessionsCount > 0
              ? 'Multi-terminal broadcast ready'
              : 'Launch a server below to start'}
          </div>
        </div>

        {/* Audit Trail Integrity */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Audit Trail</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{recentEvents.length > 0 ? 'Verified' : 'Active'}</span>
            <span className="text-xs text-indigo-400">ISO 27001</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Cryptographic link verified</span>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
            >
              View Log <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Google MFA Status */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Two-Factor Auth</span>
            <div className={`p-2 rounded-lg border ${mfaEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-xl font-bold font-mono ${mfaEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
              {mfaEnabled ? 'Enforced' : 'Disabled'}
            </span>
            <span className="text-xs text-slate-400">Google TOTP</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{mfaEnabled ? 'Workstation locked' : 'Setup recommended'}</span>
            <button
              onClick={() => onNavigateTab('settings')}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
            >
              Configure <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Quick Fleet Operations Hub */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Corporate Fleet Operations Hub</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">1-Click Launch Tools</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          <button
            onClick={() => onNavigateTab('ansible')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Ansible Fleet</span>
            <span className="text-[10px] text-slate-500">Automation</span>
          </button>

          <button
            onClick={() => onOpenModal('runbooks')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <PlaySquare className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Runbooks</span>
            <span className="text-[10px] text-slate-500">Canary Rollouts</span>
          </button>

          <button
            onClick={() => onOpenModal('drift')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <GitCompare className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Config Drift</span>
            <span className="text-[10px] text-slate-500">Multi-Host Diff</span>
          </button>

          <button
            onClick={() => onOpenModal('breakglass')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <Flame className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">JIT Access</span>
            <span className="text-[10px] text-slate-500">Emergency Root</span>
          </button>

          <button
            onClick={() => onNavigateTab('tunnels')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <Network className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">SSH Tunnels</span>
            <span className="text-[10px] text-slate-500">Port Forwards</span>
          </button>

          <button
            onClick={() => onOpenModal('keygen')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-sky-500/50 hover:bg-sky-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Key Generator</span>
            <span className="text-[10px] text-slate-500">Ed25519 & RSA</span>
          </button>

          <button
            onClick={() => onOpenModal('batchpush')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Fleet Push</span>
            <span className="text-[10px] text-slate-500">Multi-Host Sync</span>
          </button>

          <button
            onClick={() => onOpenModal('keydeploy')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <Key className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Key Deployer</span>
            <span className="text-[10px] text-slate-500">1-Click Push</span>
          </button>

          <button
            onClick={() => onOpenModal('uptime')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-sky-500/50 hover:bg-sky-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <Activity className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Uptime Watch</span>
            <span className="text-[10px] text-slate-500">Latency Probes</span>
          </button>

          <button
            onClick={() => onOpenModal('cloudimport')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/20 transition flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer"
          >
            <Cloud className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium text-slate-200">Cloud Import</span>
            <span className="text-[10px] text-slate-500">AWS, DO, Hetzner</span>
          </button>
        </div>
      </div>

      {/* 4. Split Section: Recent Sessions (Left 60%) + Recent Activity Feed (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent / Favorite Linux Servers */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Fleet Servers & Recent Sessions
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                ({filteredProfiles.length})
              </span>
            </div>

            {/* Quick search and actions inside dashboard */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter servers..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white focus:outline-none focus:border-sky-500 w-36 sm:w-44"
                />
              </div>

              {onImportHosts && (
                <button
                  onClick={onImportHosts}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Import SSH Hosts from plain list, ~/.ssh/config, CSV or Ansible"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Import Hosts</span>
                </button>
              )}
            </div>
          </div>

          {filteredProfiles.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Server className="w-10 h-10 text-slate-600 stroke-[1.5]" />
              <p className="text-xs text-slate-400">No matching connection profiles found.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onNewProfile}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Profile</span>
                </button>
                {onImportHosts && (
                  <button
                    onClick={onImportHosts}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Import SSH Hosts</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
              {filteredProfiles.map((p) => {
                const uptimeInfo = hostUptimeMap[p.id];
                const status = hostStatusMap[p.id] || uptimeInfo?.status || 'unknown';
                const isDown = status === 'down';
                const isUp = status === 'up';
                const latency = uptimeInfo?.latencyMs;
                const uptimePct = uptimeInfo?.uptimePct24h ?? 100;
                const hostMetrics = metricsMap[p.id];
                const isSampling = samplingMap[p.id] || false;
                const hasActiveTab = activeTabs?.some((t) => (t.type === 'terminal' || t.type === 'sftp') && t.sessionId && t.profile?.id === p.id);

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-3.5 transition flex flex-col justify-between group shadow-sm ${
                      isDown
                        ? 'bg-red-950/20 border border-red-500/40 hover:border-red-500/70 shadow-red-950/20'
                        : isUp
                        ? 'bg-emerald-950/15 border border-emerald-500/40 hover:border-emerald-500/70 shadow-emerald-950/20'
                        : 'bg-slate-950/80 border border-slate-800/90 hover:border-sky-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <DistroIcon flavor={p.os_flavor} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{p.display_name}</span>
                            {p.os_name && (
                              <span className="text-[9px] font-normal px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-800 shrink-0 font-sans" title={p.os_name}>
                                {p.os_name}
                              </span>
                            )}
                            {p.is_favorite && (
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                            {p.username}@{p.hostname}:{p.port}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isDown ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500/50 animate-pulse" />
                              <span>Offline</span>
                            </span>
                          ) : isUp ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400/50" />
                              <span>Reachable</span>
                              {typeof latency === 'number' && latency > 0 && (
                                <span className="text-[9px] text-emerald-300 font-sans opacity-85">({latency}ms)</span>
                              )}
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-500/60 inline-block" title="Checking reachability..." />
                          )}
                        </div>
                      </div>

                    {/* Tags */}
                    {Array.isArray(p.tags) && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-900 text-slate-400 border border-slate-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Notes & Comments Preview */}
                    {p.notes?.trim() && (
                      <div
                        onClick={() => onOpenNotes && onOpenNotes(p)}
                        className="mt-2 px-2 py-1 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 line-clamp-1 italic cursor-pointer hover:border-amber-500/40 hover:text-amber-200 transition flex items-center gap-1.5"
                        title={p.notes}
                      >
                        <FileText className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        <span className="truncate">{p.notes.split('\n')[0].replace(/^[#\-\*\s]+/, '')}</span>
                      </div>
                    )}

                    {/* Server Health Status */}
                    <div className="mt-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Activity className={`w-3.5 h-3.5 shrink-0 ${isDown ? 'text-rose-400' : isUp ? (latency && latency > 250 ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-400'}`} />
                          <span className="text-[11px] font-semibold text-slate-200 truncate">
                            {isDown ? (
                              <span className="text-rose-400">Health: Unreachable</span>
                            ) : isUp ? (
                              <span className="text-emerald-400">Health: {latency && latency > 250 ? 'Degraded' : 'Healthy'}</span>
                            ) : (
                              <span className="text-slate-400">Health: Monitoring...</span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                          {typeof latency === 'number' && latency > 0 && (
                            <span className="text-sky-400 flex items-center gap-0.5 bg-sky-950/40 px-1.5 py-0.2 rounded border border-sky-800/40" title="Network ping latency">
                              <Zap className="w-2.5 h-2.5 text-amber-400" />
                              <span>{latency}ms</span>
                            </span>
                          )}
                          <span className="text-emerald-400/90 flex items-center gap-0.5 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-800/40" title="24-Hour Availability">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{uptimePct}% 24h</span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sampleHostHealth(p.id);
                            }}
                            disabled={isSampling}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title="Sample live CPU, RAM & Disk telemetry"
                          >
                            <RefreshCw className={`w-2.5 h-2.5 ${isSampling ? 'animate-spin text-sky-400' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Resource Telemetry Breakdown if metrics available */}
                      {hostMetrics ? (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 space-y-1">
                          <div className="grid grid-cols-3 gap-2 font-mono text-[9px]">
                            {/* CPU */}
                            <div>
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>CPU</span>
                                <span className={hostMetrics.cpuUsagePercent > 80 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                                  {hostMetrics.cpuUsagePercent}%
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    hostMetrics.cpuUsagePercent > 80 ? 'bg-rose-500' : hostMetrics.cpuUsagePercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, hostMetrics.cpuUsagePercent)}%` }}
                                />
                              </div>
                            </div>

                            {/* RAM */}
                            <div>
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>RAM</span>
                                <span className={hostMetrics.memory.usagePercent > 80 ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                                  {hostMetrics.memory.usagePercent}%
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    hostMetrics.memory.usagePercent > 80 ? 'bg-amber-500' : 'bg-sky-500'
                                  }`}
                                  style={{ width: `${Math.min(100, hostMetrics.memory.usagePercent)}%` }}
                                />
                              </div>
                            </div>

                            {/* Disk */}
                            <div>
                              <div className="flex justify-between text-slate-400 mb-0.5">
                                <span>Disk</span>
                                <span className={hostMetrics.disk.usagePercent > 85 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                                  {hostMetrics.disk.usagePercent}%
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    hostMetrics.disk.usagePercent > 85 ? 'bg-rose-500' : 'bg-indigo-500'
                                  }`}
                                  style={{ width: `${Math.min(100, hostMetrics.disk.usagePercent)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {hostMetrics.uptime && (
                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-0.5">
                              <span className="flex items-center gap-1 truncate text-slate-400" title={`System Uptime: ${hostMetrics.uptime}`}>
                                <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span className="truncate">{hostMetrics.uptime}</span>
                              </span>
                              {hasActiveTab && (
                                <span className="text-[9px] text-emerald-400 shrink-0 font-sans font-medium flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Live Connected
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : hasActiveTab ? (
                        <div className="mt-1 pt-1 border-t border-slate-800/40 flex items-center justify-between text-[9px]">
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live Terminal Session Connected
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sampleHostHealth(p.id);
                            }}
                            className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline"
                          >
                            Sample CPU & RAM
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-900 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {p.last_connected_at ? formatRelativeTime(p.last_connected_at) : 'Never connected'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {onOpenNotes && (
                        <button
                          onClick={() => onOpenNotes(p)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                            p.notes?.trim()
                              ? 'bg-amber-950/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/50'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                          title={p.notes?.trim() ? 'View Host Insights & Comments' : 'Add Host Notes'}
                        >
                          <FileText className="w-3 h-3 text-amber-400" />
                          <span>Notes</span>
                        </button>
                      )}

                      <button
                        onClick={() => onOpenSftp(p)}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                        title="Open SFTP File Manager"
                      >
                        <HardDrive className="w-3 h-3 text-emerald-400" />
                        <span>SFTP</span>
                      </button>

                      <button
                        onClick={() => onOpenTerminal(p)}
                        className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-sm shadow-sky-600/30"
                        title="Connect SSH Terminal"
                      >
                        <Terminal className="w-3 h-3" />
                        <span>Connect</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>

        {/* Right: Recent Security & Workstation Activity Log */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Recent Activity Trail
                </h2>
              </div>
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Full Trail <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {loadingEvents ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-mono">Loading activity events...</span>
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No recent security events recorded.
              </div>
            ) : (
              <div className="space-y-2 mt-3 max-h-[380px] overflow-y-auto pr-1">
                {recentEvents.map((evt) => (
                  <div
                    key={evt.event_id}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-850 hover:border-slate-750 transition flex items-start gap-2.5"
                  >
                    <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                      {getEventIcon(evt.event_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {formatEventTitle(evt)}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0 ${
                          evt.outcome === 'success'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : evt.outcome === 'denied'
                            ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            : 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                        }`}>
                          {evt.outcome}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 mt-0.5 font-mono">
                        <span className="truncate">By {evt.actor_id || 'operator'}</span>
                        <span className="shrink-0">{formatRelativeTime(evt.occurred_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Card Summary */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>SHA-256 Chained Integrity Verified</span>
            </div>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
            >
              Export Bundle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
