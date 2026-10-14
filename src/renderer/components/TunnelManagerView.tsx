import React, { useState, useEffect } from 'react';
import { PortForwardConfig, ConnectionProfile } from '../../domain/types';
import {
  Network,
  Play,
  Square,
  Plus,
  Trash2,
  Edit3,
  Server,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Activity,
  Layers,
  ArrowLeftRight,
  Globe,
  Radio,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

const TUNNEL_TYPE_OPTIONS: CustomSelectOption<'local' | 'remote' | 'dynamic'>[] = [
  {
    value: 'local',
    label: 'Local Port Forwarding (-L)',
    description: 'Binds a local port on your machine and forwards traffic to a remote host through SSH.',
    badge: 'Local',
    badgeVariant: 'sky',
    dotColor: 'sky'
  },
  {
    value: 'remote',
    label: 'Remote Port Forwarding (-R)',
    description: 'Binds a port on the remote server and forwards incoming traffic back to your machine.',
    badge: 'Remote',
    badgeVariant: 'purple',
    dotColor: 'purple'
  },
  {
    value: 'dynamic',
    label: 'Dynamic SOCKS5 Proxy (-D)',
    description: 'Turns your machine port into a SOCKS5 proxy to route browser or app traffic through the remote server.',
    badge: 'SOCKS5',
    badgeVariant: 'emerald',
    dotColor: 'emerald'
  }
];

export const TunnelManagerView: React.FC = () => {
  const [tunnels, setTunnels] = useState<PortForwardConfig[]>([]);
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [statuses, setStatuses] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Create / Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [profileId, setProfileId] = useState('');
  const [type, setType] = useState<'local' | 'remote' | 'dynamic'>('local');
  const [localHost, setLocalHost] = useState('127.0.0.1');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(80);
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(refreshStatuses, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tList, pList, st] = await Promise.all([
        (window as any).dgodterm.getTunnels(),
        (window as any).dgodterm.getProfiles(),
        (window as any).dgodterm.getTunnelStatuses()
      ]);
      setTunnels(tList || []);
      setProfiles(pList || []);
      setStatuses(st || {});
      if (!profileId && pList && pList.length > 0) {
        setProfileId(pList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load tunnels:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatuses = async () => {
    try {
      const st = await (window as any).dgodterm.getTunnelStatuses();
      setStatuses(st || {});
    } catch (e) {}
  };

  const handleStartTunnel = async (id: string) => {
    setErrorMsg('');
    try {
      await (window as any).dgodterm.startTunnel(id);
      await refreshStatuses();
    } catch (err: any) {
      setErrorMsg(`Failed to start tunnel: ${err.message || String(err)}`);
    }
  };

  const handleStopTunnel = async (id: string) => {
    try {
      await (window as any).dgodterm.stopTunnel(id);
      await refreshStatuses();
    } catch (err: any) {
      console.error('Failed to stop tunnel:', err);
    }
  };

  const handleDeleteTunnel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this port forwarding tunnel?')) return;
    try {
      await (window as any).dgodterm.deleteTunnel(id);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete tunnel:', err);
    }
  };

  const handleSaveTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !profileId) return;

    try {
      await (window as any).dgodterm.saveTunnel({
        id: editingId || undefined,
        name: name.trim(),
        profileId,
        type,
        localHost: localHost.trim() || '127.0.0.1',
        localPort: Number(localPort) || 8080,
        remoteHost: type === 'dynamic' ? undefined : remoteHost.trim() || '127.0.0.1',
        remotePort: type === 'dynamic' ? undefined : Number(remotePort) || 80,
        autoStart
      });
      setShowEditModal(false);
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(`Failed to save tunnel: ${err.message || String(err)}`);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setType('local');
    setLocalHost('127.0.0.1');
    setLocalPort(8080);
    setRemoteHost('127.0.0.1');
    setRemotePort(80);
    setAutoStart(false);
    if (profiles.length > 0) setProfileId(profiles[0].id);
    setShowEditModal(true);
  };

  const openEditModal = (t: PortForwardConfig) => {
    setEditingId(t.id);
    setName(t.name);
    setProfileId(t.profileId);
    setType(t.type);
    setLocalHost(t.localHost || '127.0.0.1');
    setLocalPort(t.localPort);
    setRemoteHost(t.remoteHost || '127.0.0.1');
    setRemotePort(t.remotePort || 80);
    setAutoStart(Boolean(t.autoStart));
    setShowEditModal(true);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-800 text-purple-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              SSH Port Forwarding & Tunnels Manager
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300">
                {tunnels.length} Configured
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Manage Local (-L), Remote (-R), and Dynamic SOCKS5 (-D) tunnels with live connection telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshStatuses}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition cursor-pointer"
            title="Refresh tunnel statuses"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-950 font-semibold text-xs transition cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>New Port Forward</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {tunnels.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-8 space-y-3 bg-slate-900/20">
            <Network className="w-10 h-10 text-slate-600" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-300">No Port Forwarding Tunnels Configured</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Create a Local Port Forward to access remote databases locally, Remote Forward to expose local services, or Dynamic SOCKS5 Proxy to route browser traffic.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-950 font-semibold text-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Tunnel</span>
            </button>
          </div>
        ) : (
          tunnels.map((tun) => {
            const profile = profiles.find((p) => p.id === tun.profileId);
            const statusInfo = statuses[tun.id] || { status: 'stopped', activeConnections: 0, bytesTransferred: 0 };
            const isRunning = statusInfo.status === 'running';
            const isError = statusInfo.status === 'error';

            return (
              <div
                key={tun.id}
                className="bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 transition shadow-sm flex items-center justify-between gap-4"
              >
                {/* Left: Info & Mapping */}
                <div className="flex items-center gap-4 flex-1">
                  <div className={`p-2.5 rounded-lg border ${
                    isRunning
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                      : isError
                      ? 'bg-red-950/60 border-red-800 text-red-400'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}>
                    {tun.type === 'dynamic' ? (
                      <Globe className="w-5 h-5" />
                    ) : (
                      <ArrowLeftRight className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 text-sm">{tun.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold ${
                        tun.type === 'local'
                          ? 'bg-sky-950 border border-sky-800 text-sky-300'
                          : tun.type === 'remote'
                          ? 'bg-purple-950 border border-purple-800 text-purple-300'
                          : 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                      }`}>
                        {tun.type === 'dynamic' ? 'Dynamic SOCKS5' : tun.type + ' Forward'}
                      </span>
                      {profile && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          via <strong className="text-slate-300 font-normal">@{profile.display_name}</strong>
                          <span className="text-slate-500 font-mono text-[10px]">({profile.hostname})</span>
                        </span>
                      )}
                    </div>

                    {/* Port Routing Visual */}
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300 pt-0.5">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-sky-300">
                        {tun.localHost || '127.0.0.1'}:{tun.localPort}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {tun.type === 'dynamic' ? (
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-emerald-300">
                          Internet / Any Host (SOCKS5 Proxy)
                        </span>
                      ) : (
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-purple-300">
                          {tun.remoteHost || '127.0.0.1'}:{tun.remotePort}
                        </span>
                      )}
                    </div>

                    {statusInfo.errorMessage && (
                      <p className="text-[11px] text-red-400">{statusInfo.errorMessage}</p>
                    )}
                  </div>
                </div>

                {/* Middle: Metrics */}
                <div className="flex items-center gap-6 text-xs text-slate-400 border-l border-slate-800/80 pl-6">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Status</span>
                    <span className="flex items-center gap-1.5 font-medium mt-0.5">
                      {isRunning ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-300 font-semibold">Active</span>
                        </>
                      ) : isError ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-red-400" />
                          <span className="text-red-300">Error</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-slate-600" />
                          <span className="text-slate-400">Stopped</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Clients</span>
                    <span className="font-mono text-slate-200 mt-0.5 block">
                      {statusInfo.activeConnections || 0} active
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Transferred</span>
                    <span className="font-mono text-slate-200 mt-0.5 block">
                      {formatBytes(statusInfo.bytesTransferred)}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 border-l border-slate-800/80 pl-6">
                  {isRunning ? (
                    <button
                      onClick={() => handleStopTunnel(tun.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-semibold transition cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 fill-red-200" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartTunnel(tun.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold transition cursor-pointer shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Start</span>
                    </button>
                  )}

                  <button
                    onClick={() => openEditModal(tun)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title="Edit Tunnel"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteTunnel(tun.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition cursor-pointer"
                    title="Delete Tunnel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-400" />
                {editingId ? 'Edit Port Forwarding' : 'Configure New Port Forwarding'}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTunnel} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Tunnel Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Postgres DB Forward, App Proxy, SOCKS5"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Target SSH Profile *</label>
                <CustomSelect
                  value={profileId}
                  onChange={(v) => setProfileId(String(v))}
                  options={profiles.map((p) => ({
                    value: p.id,
                    label: p.display_name,
                    description: `${p.username}@${p.hostname}:${p.port}`
                  }))}
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Tunnel Type</label>
                <CustomSelect
                  value={type}
                  onChange={(v) => setType(v as any)}
                  options={TUNNEL_TYPE_OPTIONS}
                />
              </div>

              {/* Local Binding */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Local Bind Address</label>
                  <input
                    type="text"
                    value={localHost}
                    onChange={(e) => setLocalHost(e.target.value)}
                    placeholder="127.0.0.1 or 0.0.0.0"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Local Port *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={localPort}
                    onChange={(e) => setLocalPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Remote Endpoint (Only for local or remote forward) */}
              {type !== 'dynamic' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Remote Target Host *</label>
                    <input
                      type="text"
                      required
                      value={remoteHost}
                      onChange={(e) => setRemoteHost(e.target.value)}
                      placeholder="127.0.0.1 or internal.db"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Remote Target Port *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={65535}
                      value={remotePort}
                      onChange={(e) => setRemotePort(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-950 font-semibold transition cursor-pointer shadow-md"
                >
                  Save Tunnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
