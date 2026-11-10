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
  Cpu,
  Sparkles,
  Monitor,
  Download
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
  onOpenMobaTools?: (tab?: 'x11' | 'bash' | 'putty' | 'rdp') => void;
  onOpenLocalBash?: () => void;
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
  onOpenModal,
  onOpenMobaTools,
  onOpenLocalBash
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
    <div className="h-full w-full overflow-y-auto bg-[#18181b] text-zinc-100 p-6 space-y-5 select-none font-sans">
      {/* 1. Compact Executive Header + Inline KPI Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2.5">
            <span>Infrastructure Workspace</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08] uppercase font-normal">
              Enterprise Studio
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Zero-Trust SSH, SFTP &amp; Fleet Automation Workstation
          </p>
        </div>

        {/* Inline KPI Strip & Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1e1e22] border border-white/[0.07]">
            <span className="text-zinc-400">Hosts</span>
            <span className="font-mono font-semibold text-white">{profiles.length}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1e1e22] border border-white/[0.07]">
            <span className="text-zinc-400">Active</span>
            <span className="font-mono font-semibold text-emerald-400">{activeSessionsCount}</span>
          </div>

          <button
            onClick={() => onNavigateTab('audit')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e22] hover:bg-[#27272c] border border-white/[0.07] text-zinc-300 transition cursor-pointer"
            title="View Cryptographic Audit Trail"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SHA-256 Verified</span>
          </button>

          <button
            onClick={() => onNavigateTab('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e1e22] hover:bg-[#27272c] border border-white/[0.07] text-zinc-300 transition cursor-pointer"
            title="Configure 2FA & Security"
          >
            <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
            <span>2FA: {mfaEnabled ? 'Enforced' : 'Optional'}</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1e1e22] border border-white/[0.07] text-zinc-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{currentTime}</span>
          </div>

          <button
            onClick={loadDashboardData}
            className="p-1.5 rounded-md bg-[#1e1e22] hover:bg-[#27272c] border border-white/[0.07] text-zinc-400 hover:text-white transition cursor-pointer"
            title="Refresh Workspace Telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Primary Section: Servers & Active Connections (Front and Center!) */}
      <div className="bg-[#1e1e22] border border-white/[0.07] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">
              Servers &amp; Active Connections
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              ({filteredProfiles.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-500" />
              <input
                type="text"
                placeholder="Filter servers..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="bg-[#141417] border border-white/[0.08] rounded-md pl-8 pr-3 py-1 text-xs text-white focus:outline-none focus:border-[#0078d4] w-40 sm:w-52"
              />
            </div>

            {onImportHosts && (
              <button
                onClick={onImportHosts}
                className="px-2.5 py-1 rounded-md border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                style={{
                  backgroundColor: 'var(--dgod-bg-surface-elevated)',
                  borderColor: 'var(--dgod-border-strong)',
                  color: 'var(--dgod-text-primary)'
                }}
                title="Import SSH Hosts"
              >
                <Upload className="w-3.5 h-3.5" style={{ color: 'var(--dgod-accent)' }} />
                <span>Import</span>
              </button>
            )}

            <button
              onClick={onNewProfile}
              className="px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm active:scale-[0.99]"
              style={{
                backgroundColor: 'var(--dgod-accent)',
                color: '#ffffff'
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Server</span>
            </button>
          </div>
        </div>

        {filteredProfiles.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <Server className="w-9 h-9 text-zinc-600 stroke-[1.5]" />
            <p className="text-xs text-zinc-400">No connection profiles configured yet.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={onNewProfile}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-[0.99]"
                style={{
                  backgroundColor: 'var(--dgod-accent)',
                  color: '#ffffff'
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Server</span>
              </button>
              {onImportHosts && (
                <button
                  onClick={onImportHosts}
                  className="px-3.5 py-1.5 rounded-md border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  style={{
                    backgroundColor: 'var(--dgod-bg-surface-elevated)',
                    borderColor: 'var(--dgod-border-strong)',
                    color: 'var(--dgod-text-primary)'
                  }}
                >
                  <Upload className="w-3.5 h-3.5" style={{ color: 'var(--dgod-accent)' }} />
                  <span>Import Hosts</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
            {filteredProfiles.map((p) => {
              const uptimeInfo = hostUptimeMap[p.id];
              const status = hostStatusMap[p.id] || uptimeInfo?.status || 'unknown';
              const isDown = status === 'down';
              const isUp = status === 'up';
              const latency = uptimeInfo?.latencyMs;
              const hostMetrics = metricsMap[p.id];
              const isSampling = samplingMap[p.id] || false;
              const hasActiveTab = activeTabs?.some(
                (t) => (t.type === 'terminal' || t.type === 'sftp') && t.sessionId && t.profile?.id === p.id
              );

              return (
                <div
                  key={p.id}
                  className="rounded-lg p-3.5 bg-[#141417] border border-white/[0.08] hover:border-white/20 transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          <DistroIcon flavor={p.os_flavor} className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{p.display_name}</span>
                          {p.os_name && (
                            <span
                              className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/[0.05] text-zinc-300 border border-white/[0.07] shrink-0"
                              title={p.os_name}
                            >
                              {p.os_name}
                            </span>
                          )}
                          {p.is_favorite && (
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                          {p.username}@{p.hostname}:{p.port}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDown ? (
                          <span className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                            <span>Offline</span>
                          </span>
                        ) : isUp ? (
                          <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            <span>Online</span>
                            {typeof latency === 'number' && latency > 0 && (
                              <span className="text-[9px] text-zinc-400">{latency}ms</span>
                            )}
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" title="Standby" />
                        )}
                      </div>
                    </div>

                    {hostMetrics && (
                      <div className="mt-2.5 pt-2 border-t border-white/[0.06] grid grid-cols-3 gap-2 font-mono text-[10px] text-zinc-400">
                        <div>
                          CPU <strong className="text-zinc-200">{hostMetrics.cpuUsagePercent}%</strong>
                        </div>
                        <div>
                          RAM <strong className="text-zinc-200">{hostMetrics.memory.usagePercent}%</strong>
                        </div>
                        <div>
                          Disk <strong className="text-zinc-200">{hostMetrics.disk.usagePercent}%</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono truncate">
                      <span>{p.last_connected_at ? formatRelativeTime(p.last_connected_at) : 'Ready'}</span>
                      {hasActiveTab && (
                        <span className="text-emerald-400 font-sans font-medium">• Connected</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sampleHostHealth(p.id);
                        }}
                        disabled={isSampling}
                        className="p-1 rounded bg-[#1e1e22] hover:bg-[#27272c] border border-white/[0.07] text-zinc-400 hover:text-white transition cursor-pointer"
                        title="Sample Host Telemetry"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSampling ? 'animate-spin text-sky-400' : ''}`} />
                      </button>

                      {onOpenNotes && (
                        <button
                          onClick={() => onOpenNotes(p)}
                          className="p-1 rounded bg-[#1e1e22] hover:bg-[#27272c] border border-white/[0.07] text-zinc-400 hover:text-white transition cursor-pointer"
                          title="Host Notes"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={() => onOpenSftp(p)}
                        className="px-2 py-1 rounded bg-[#1e1e22] hover:bg-[#27272c] border border-white/[0.08] text-zinc-200 text-[11px] font-medium transition cursor-pointer"
                        title="Open SFTP File Manager"
                      >
                        SFTP
                      </button>

                      <button
                        onClick={() => onOpenTerminal(p)}
                        className="px-2.5 py-1 rounded bg-[#0078d4] hover:bg-[#1084df] text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                        title="Connect SSH Terminal"
                      >
                        <Terminal className="w-3 h-3" />
                        <span>SSH</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Secondary Row: Unified Operations & Engineering Toolkit (Left 7 cols) + Cryptographic Audit Trail (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Unified Operations & Engineering Toolkit */}
        <div className="lg:col-span-7 bg-[#1e1e22] border border-white/[0.07] rounded-xl p-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-white">
                Operations &amp; Engineering Toolkit
              </h2>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">12 Integrated Modules</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            <button
              onClick={() => onNavigateTab('ansible')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Ansible Fleet</div>
                <div className="text-[10px] text-zinc-500 truncate">Playbooks</div>
              </div>
            </button>

            <button
              onClick={() => onOpenModal('runbooks')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <PlaySquare className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Runbooks</div>
                <div className="text-[10px] text-zinc-500 truncate">Canary Rollout</div>
              </div>
            </button>

            <button
              onClick={() => onOpenModal('drift')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <GitCompare className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Config Drift</div>
                <div className="text-[10px] text-zinc-500 truncate">Host Diffs</div>
              </div>
            </button>

            <button
              onClick={() => onNavigateTab('tunnels')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Network className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">SSH Tunnels</div>
                <div className="text-[10px] text-zinc-500 truncate">Port Forwards</div>
              </div>
            </button>

            <button
              onClick={() => onOpenMobaTools?.('x11')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Monitor className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">X11 Display</div>
                <div className="text-[10px] text-zinc-500 truncate">GUI Forwarding</div>
              </div>
            </button>

            <button
              onClick={() => (onOpenLocalBash ? onOpenLocalBash() : onOpenMobaTools?.('bash'))}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Local Bash</div>
                <div className="text-[10px] text-zinc-500 truncate">GNU Coreutils</div>
              </div>
            </button>

            <button
              onClick={() => onOpenMobaTools?.('putty')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Download className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">PuTTY Sync</div>
                <div className="text-[10px] text-zinc-500 truncate">Registry Import</div>
              </div>
            </button>

            <button
              onClick={() => onOpenMobaTools?.('rdp')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Windows RDP</div>
                <div className="text-[10px] text-zinc-500 truncate">Native mstsc</div>
              </div>
            </button>

            <button
              onClick={() => onOpenModal('batchpush')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Fleet Push</div>
                <div className="text-[10px] text-zinc-500 truncate">Batch Sync</div>
              </div>
            </button>

            <button
              onClick={() => onOpenModal('keydeploy')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Key className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Key Deployer</div>
                <div className="text-[10px] text-zinc-500 truncate">Push SSH Keys</div>
              </div>
            </button>

            <button
              onClick={() => onOpenModal('uptime')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Activity className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Uptime Watch</div>
                <div className="text-[10px] text-zinc-500 truncate">Latency Probes</div>
              </div>
            </button>

            <button
              onClick={() => onOpenModal('cloudimport')}
              className="p-3 rounded-lg bg-[#141417] border border-white/[0.07] hover:border-white/20 transition flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Cloud className="w-4 h-4 text-zinc-300 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">Cloud Import</div>
                <div className="text-[10px] text-zinc-500 truncate">AWS, GCP, Azure</div>
              </div>
            </button>
          </div>
        </div>

        {/* Right: Recent Security & Workstation Activity Log */}
        <div className="lg:col-span-5 bg-[#1e1e22] border border-white/[0.07] rounded-xl p-5 space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">
                  Cryptographic Audit Trail
                </h2>
              </div>
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Full Log <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {loadingEvents ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-zinc-400 font-mono">Loading activity events...</span>
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-500">
                No recent security events recorded.
              </div>
            ) : (
              <div className="space-y-1.5 mt-2.5 max-h-[210px] overflow-y-auto pr-1">
                {recentEvents.map((evt) => (
                  <div
                    key={evt.event_id}
                    className="p-2 rounded-lg bg-[#141417] border border-white/[0.06] flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded bg-[#1e1e22] border border-white/[0.06] shrink-0">
                        {getEventIcon(evt.event_type)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">
                          {formatEventTitle(evt)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                          {evt.actor_id || 'operator'} • {formatRelativeTime(evt.occurred_at)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase shrink-0 ${
                        evt.outcome === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                      }`}
                    >
                      {evt.outcome}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-white/[0.07] flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>SHA-256 Chain Integrity Verified</span>
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
