import React, { useState, useEffect } from 'react';
import { ConnectionProfile } from '../../domain/types';
import {
  Zap,
  Terminal,
  HardDrive,
  X,
  Eye,
  EyeOff,
  Server,
  Lock,
  Bookmark,
  Check
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface QuickConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (profile: ConnectionProfile, password?: string, mode?: 'terminal' | 'sftp') => void;
}

export const QuickConnectModal: React.FC<QuickConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect
}) => {
  const [quickString, setQuickString] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'terminal' | 'sftp'>('terminal');
  const [saveProfile, setSaveProfile] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Handle parsing when quick string changes (e.g. user@host:port or host:port or host)
  const handleQuickStringChange = (val: string) => {
    setQuickString(val);
    setErrorMsg('');

    const trimmed = val.trim();
    if (!trimmed) return;

    let userPart = '';
    let hostPart = trimmed;
    let portPart = 22;

    // Check for user@
    if (hostPart.includes('@')) {
      const atSplit = hostPart.split('@');
      userPart = atSplit[0];
      hostPart = atSplit.slice(1).join('@');
    }

    // Check for :port
    if (hostPart.includes(':')) {
      const colonSplit = hostPart.split(':');
      hostPart = colonSplit[0];
      const parsedPort = parseInt(colonSplit[1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        portPart = parsedPort;
      }
    }

    if (userPart) setUsername(userPart);
    if (hostPart) setHostname(hostPart);
    setPort(portPart);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalHost = hostname.trim() || quickString.trim();
    const finalUser = username.trim() || 'root';

    if (!finalHost) {
      setErrorMsg('Please enter a target hostname or IP address.');
      return;
    }

    const profileId = uuidv4();
    const title = displayName.trim() || `${finalUser}@${finalHost}`;
    let authReference = password
      ? ({ kind: 'transient_prompt', reference_id: 'ref-quick' } as const)
      : null;

    if (saveProfile) {
      try {
        const dgodterm = (window as any).dgodterm;
        if (password && dgodterm?.saveVaultCredential) {
          const savedCred = await dgodterm.saveVaultCredential({
            id: `vault-${profileId}`,
            title: `${title} (${finalUser}@${finalHost})`,
            username: finalUser,
            password,
            notes: `Saved via Quick Connect for ${finalUser}@${finalHost}:${port || 22}`
          });
          authReference = {
            kind: 'vault_reference',
            reference_id: savedCred?.id || `vault-${profileId}`,
            account_or_key_label: savedCred?.title || title,
            key_path: null,
            last_used_at: new Date().toISOString()
          } as any;
        }
      } catch (err) {
        console.error('Failed to save Quick Connect vault credential:', err);
      }
    }

    const newProfile: ConnectionProfile = {
      id: profileId,
      schema_version: 1,
      display_name: title,
      hostname: finalHost,
      port: port || 22,
      username: finalUser,
      folder_id: null,
      tags: ['quick-connect'],
      jump_host_profile_id: null,
      auth_reference: authReference,
      host_trust_policy_id: null,
      ssh_options: {
        keepalive_interval: 30,
        terminal_type: 'xterm'
      },
      is_favorite: false,
      last_connected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'quick-connect'
    };

    if (saveProfile) {
      try {
        await (window as any).dgodterm?.saveProfile?.(newProfile);
        window.dispatchEvent(new CustomEvent('dgodterm:profile-saved', { detail: newProfile }));
      } catch (err) {
        console.error('Failed to save Quick Connect profile:', err);
      }
    }

    onConnect(newProfile, password || undefined, mode);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Quick Connect
              </h3>
              <p className="text-xs text-slate-400">
                Connect directly to any server, switch, or router instantly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Quick String Bar */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Quick Target URI (or enter details below):
            </label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="e.g. HMeshack@192.168.21.253:22 or admin@10.0.0.1"
                value={quickString}
                onChange={(e) => handleQuickStringChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-mono">
                user@host:port
              </span>
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="text-slate-300 font-medium block mb-1">
                Hostname or IP <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="192.168.21.253 or server.internal"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-slate-300 font-medium block mb-1">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Username <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HMeshack, admin, root"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Password <span className="text-slate-500 text-[10px]">(optional prompt)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter login password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs pr-9 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="text-slate-300 font-medium block mb-1.5">Connection Mode:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('terminal')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-medium transition ${
                  mode === 'terminal'
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>SSH Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('sftp')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border font-medium transition ${
                  mode === 'sftp'
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>SFTP Browser</span>
              </button>
            </div>
          </div>

          {/* Save Profile Option */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={saveProfile}
                onChange={(e) => setSaveProfile(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                Save this connection as a permanent profile
              </span>
            </label>

            {saveProfile && (
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Profile Name (e.g. Cisco Core Switch, Prod-DB)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg transition"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Connect Now</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
