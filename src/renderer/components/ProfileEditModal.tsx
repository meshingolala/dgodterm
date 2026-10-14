import React, { useState, useEffect } from 'react';
import { ConnectionProfile, Folder, CredentialReference, VaultCredential } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';
import {
  Server,
  Folder as FolderIcon,
  Tag,
  Key,
  Sliders,
  Shield,
  X,
  Lock,
  AlertCircle,
  Plus,
  Eye,
  EyeOff,
  Sparkles,
  Network,
  FileText
} from 'lucide-react';
import { CustomSelect, CustomSelectOption } from './CustomSelect';
import { SSHKeyGeneratorModal } from './SSHKeyGeneratorModal';
import { DistroIcon } from './DistroIcon';

const AUTH_OPTIONS: CustomSelectOption<string>[] = [
  {
    value: 'vault_reference',
    label: 'Password Vault (Saved Password)',
    description: 'Use a master-encrypted credential stored in your local Password Vault.',
    badge: 'Vault',
    badgeVariant: 'amber',
    dotColor: 'amber',
  },
  {
    value: 'transient_prompt',
    label: 'Password Authentication',
    description: 'Prompts on connect; never stores raw password on disk.',
    badge: 'Prompt',
    badgeVariant: 'sky',
    dotColor: 'sky',
  },
  {
    value: 'ssh_agent',
    label: 'OS SSH Agent / Hardware Key',
    description: 'Uses Pageant, OpenSSH Agent, or YubiKey / FIDO hardware keys.',
    badge: 'Hardware',
    badgeVariant: 'emerald',
    dotColor: 'emerald',
  },
  {
    value: 'key_file_reference',
    label: 'Private Key File',
    description: 'Path reference to local private key file (~/.ssh/id_rsa, etc.).',
    badge: 'Keyfile',
    badgeVariant: 'indigo',
    dotColor: 'indigo',
  },
];
 
const OS_OPTIONS: CustomSelectOption<string>[] = [
  { value: '', label: '⚡ Auto-Detect on SSH Login (Recommended)', description: 'Automatically detects distro via /etc/os-release upon first connection.' },
  { value: 'oracle', label: 'Oracle Linux (OL)', badge: 'Oracle', badgeVariant: 'rose' },
  { value: 'ubuntu', label: 'Ubuntu Linux', badge: 'Ubuntu', badgeVariant: 'amber' },
  { value: 'debian', label: 'Debian GNU/Linux', badge: 'Debian', badgeVariant: 'rose' },
  { value: 'rhel', label: 'Red Hat Enterprise Linux (RHEL)', badge: 'Red Hat', badgeVariant: 'rose' },
  { value: 'centos', label: 'CentOS Stream', badge: 'CentOS', badgeVariant: 'indigo' },
  { value: 'rocky', label: 'Rocky Linux', badge: 'Rocky', badgeVariant: 'emerald' },
  { value: 'almalinux', label: 'AlmaLinux', badge: 'Alma', badgeVariant: 'sky' },
  { value: 'fedora', label: 'Fedora Linux', badge: 'Fedora', badgeVariant: 'sky' },
  { value: 'alpine', label: 'Alpine Linux', badge: 'Alpine', badgeVariant: 'sky' },
  { value: 'arch', label: 'Arch Linux', badge: 'Arch', badgeVariant: 'sky' },
  { value: 'opensuse', label: 'openSUSE / SLES', badge: 'openSUSE', badgeVariant: 'emerald' },
  { value: 'amazon', label: 'Amazon Linux (AL2 / AL2023)', badge: 'AWS', badgeVariant: 'amber' },
  { value: 'kali', label: 'Kali Linux', badge: 'Kali', badgeVariant: 'sky' },
  { value: 'raspbian', label: 'Raspberry Pi OS', badge: 'RPi', badgeVariant: 'rose' },
  { value: 'manjaro', label: 'Manjaro Linux', badge: 'Manjaro', badgeVariant: 'emerald' },
  { value: 'freebsd', label: 'FreeBSD', badge: 'BSD', badgeVariant: 'rose' },
  { value: 'linux', label: 'Generic Linux (Tux)', badge: 'Linux', badgeVariant: 'slate' },
];


interface ProfileEditModalProps {
  initialProfile?: ConnectionProfile | null;
  folders: Folder[];
  onSave: (profile: ConnectionProfile) => void;
  onCancel: () => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  initialProfile,
  folders,
  onSave,
  onCancel
}) => {
  const isEditing = Boolean(initialProfile?.id);

  const [displayName, setDisplayName] = useState(initialProfile?.display_name || '');
  const [hostname, setHostname] = useState(initialProfile?.hostname || '');
  const [port, setPort] = useState(initialProfile?.port || 22);
  const [username, setUsername] = useState(initialProfile?.username || 'root');
  const [folderId, setFolderId] = useState<string | null>(initialProfile?.folder_id || null);
  const [tagInput, setTagInput] = useState(initialProfile?.tags?.join(', ') || '');
  const [notes, setNotes] = useState(initialProfile?.notes || '');
  const [isFavorite, setIsFavorite] = useState(initialProfile?.is_favorite || false);

  // Credential Reference (Principle 2: Keep secrets out of profile data!)
  const [authKind, setAuthKind] = useState<CredentialReference['kind']>(
    initialProfile?.auth_reference?.kind || 'transient_prompt'
  );
  const [keyPath, setKeyPath] = useState(initialProfile?.auth_reference?.key_path || '');
  const [accountLabel, setAccountLabel] = useState(initialProfile?.auth_reference?.account_or_key_label || '');

  // Password Vault State
  const [vaultCredentials, setVaultCredentials] = useState<VaultCredential[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState<string>(
    initialProfile?.auth_reference?.kind === 'vault_reference'
      ? initialProfile.auth_reference.reference_id
      : ''
  );
  const [showQuickVaultAdd, setShowQuickVaultAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickUsername, setQuickUsername] = useState(initialProfile?.username || 'root');
  const [quickPassword, setQuickPassword] = useState('');
  const [showQuickPass, setShowQuickPass] = useState(false);
  const [quickError, setQuickError] = useState('');

  // Jump Host / Bastion Proxy state
  const [jumpHostProfileId, setJumpHostProfileId] = useState<string | null>(
    initialProfile?.jump_host_profile_id || null
  );
  const [allProfiles, setAllProfiles] = useState<ConnectionProfile[]>([]);
  const [showKeyGenModal, setShowKeyGenModal] = useState(false);

  // OS / Linux Flavour state
  const [osFlavor, setOsFlavor] = useState<string>(initialProfile?.os_flavor || '');
  const [osName, setOsName] = useState<string>(initialProfile?.os_name || '');

  useEffect(() => {
    loadVaultList();
    loadAllProfiles();
  }, []);

  const loadAllProfiles = async () => {
    try {
      const list = await (window as any).dgodterm.getProfiles();
      setAllProfiles(list || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadVaultList = async () => {
    try {
      const creds = await (window as any).dgodterm.getVaultCredentials();
      setVaultCredentials(creds || []);
      if (!selectedVaultId && creds && creds.length > 0 && (initialProfile?.auth_reference?.kind === 'vault_reference' || authKind === 'vault_reference')) {
        setSelectedVaultId(creds[0].id);
        if (!accountLabel) setAccountLabel(creds[0].title);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateQuickVault = async () => {
    if (!quickTitle.trim()) {
      setQuickError('Title is required');
      return;
    }
    if (!quickUsername.trim()) {
      setQuickError('Username is required');
      return;
    }
    if (!quickPassword) {
      setQuickError('Password is required');
      return;
    }
    try {
      const saved = await (window as any).dgodterm.saveVaultCredential({
        title: quickTitle.trim(),
        username: quickUsername.trim(),
        password: quickPassword
      });
      await loadVaultList();
      setSelectedVaultId(saved.id);
      setAccountLabel(saved.title);
      setShowQuickVaultAdd(false);
      setQuickTitle('');
      setQuickPassword('');
      setQuickError('');
    } catch (err: any) {
      setQuickError(err.message || 'Failed to save to vault');
    }
  };

  // Options
  const [keepalive, setKeepalive] = useState(initialProfile?.ssh_options?.keepalive_interval ?? 30);
  const [agentForwarding, setAgentForwarding] = useState(initialProfile?.ssh_options?.agent_forwarding ?? false);
  const [x11Forwarding, setX11Forwarding] = useState(initialProfile?.ssh_options?.x11_forwarding ?? false);

  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !hostname.trim() || !username.trim()) {
      setErrorMsg('Display Name, Hostname, and Username are required.');
      return;
    }

    if (authKind === 'vault_reference' && !selectedVaultId) {
      setErrorMsg('Please select a saved credential from the Password Vault or create one.');
      return;
    }

    const tags = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const selectedVault = vaultCredentials.find((c) => c.id === selectedVaultId);

    const auth_reference: CredentialReference = {
      kind: authKind,
      reference_id:
        authKind === 'vault_reference'
          ? selectedVaultId
          : authKind === 'key_file_reference'
          ? 'ref-key-' + uuidv4().slice(0, 8)
          : 'ref-' + authKind,
      account_or_key_label:
        authKind === 'vault_reference'
          ? selectedVault?.title || accountLabel.trim() || 'Vault Credential'
          : accountLabel.trim() || null,
      key_path: authKind === 'key_file_reference' ? keyPath.trim() || null : null,
      last_used_at: initialProfile?.auth_reference?.last_used_at || null
    };

    const updatedProfile: ConnectionProfile = {
      id: initialProfile?.id || uuidv4(),
      schema_version: 1,
      display_name: displayName.trim(),
      hostname: hostname.trim(),
      port,
      username: username.trim(),
      folder_id: folderId,
      tags,
      jump_host_profile_id: jumpHostProfileId || null,
      auth_reference,
      host_trust_policy_id: null,
      ssh_options: {
        keepalive_interval: keepalive,
        agent_forwarding: agentForwarding,
        x11_forwarding: x11Forwarding,
        terminal_type: 'xterm-256color'
      },
      is_favorite: isFavorite,
      last_connected_at: initialProfile?.last_connected_at || null,
      created_at: initialProfile?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: initialProfile?.created_by || 'operator',
      notes: notes.trim() || null,
      os_flavor: osFlavor.trim() || null,
      os_name: osName.trim() || (osFlavor ? (OS_OPTIONS.find((o) => o.value === osFlavor)?.label.replace(/ \(.*\)/, '') || osFlavor) : null)
    };

    onSave(updatedProfile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <DistroIcon flavor={osFlavor} size={22} className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? 'Edit Connection Profile' : 'New SSH Connection Profile'}
              </h3>
              {osName && (
                <div className="text-[11px] text-sky-400 font-medium">{osName}</div>
              )}
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-slate-400 block mb-1">Profile Display Name *</label>
              <input
                type="text"
                placeholder="e.g. Production Web Bastion 01"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Target Hostname / IP *</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.50 or bastion.domain.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Port (1-65535)</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Username *</label>
              <input
                type="text"
                placeholder="e.g. ubuntu, root, or operator"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-sky-500 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Local Organization Folder</label>
              <CustomSelect
                value={folderId || ''}
                onChange={(val) => setFolderId(val ? String(val) : null)}
                options={[
                  { value: '', label: '(No Folder / Root)' },
                  ...folders.map((f) => ({ value: f.id, label: f.name }))
                ]}
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DistroIcon flavor={osFlavor} size={14} />
                  <span>Linux Distro / OS</span>
                </span>
                <span className="text-[10px] text-sky-400 font-normal">Auto-detected on login</span>
              </label>
              <CustomSelect
                value={osFlavor}
                onChange={(val) => {
                  const f = String(val || '');
                  setOsFlavor(f);
                  const opt = OS_OPTIONS.find((o) => o.value === f);
                  if (opt) {
                    setOsName(f ? opt.label.replace(/ \(.*\)/, '') : '');
                  }
                }}
                options={OS_OPTIONS}
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 flex items-center justify-between">
                <span>Jump Host (ProxyJump)</span>
                <span className="text-[10px] text-purple-400 font-normal">Optional</span>
              </label>
              <CustomSelect
                value={jumpHostProfileId || ''}
                onChange={(val) => setJumpHostProfileId(val ? String(val) : null)}
                options={[
                  { value: '', label: 'Direct Connection (No Jump Host)' },
                  ...allProfiles
                    .filter((p) => !initialProfile || p.id !== initialProfile.id)
                    .map((p) => ({
                      value: p.id,
                      label: p.display_name,
                      description: `${p.username}@${p.hostname}:${p.port}`
                    }))
                ]}
              />
            </div>
          </div>

          {/* Authentication Reference (Security Rule: Keep secrets out of profile data) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <Key className="w-4 h-4 text-emerald-400" />
              Authentication Provider Reference
            </div>
            <p className="text-[11px] text-slate-400">
              Profiles strictly store credential references, never plaintext passwords or private key contents.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-slate-400 block mb-1">Auth Method</label>
                <CustomSelect
                  value={authKind}
                  onChange={(val) => setAuthKind(val as any)}
                  options={AUTH_OPTIONS}
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Credential Label</label>
                <input
                  type="text"
                  placeholder="e.g. YubiKey 5C or Work Laptop Key"
                  value={accountLabel}
                  onChange={(e) => setAccountLabel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>
            </div>

            {authKind === 'key_file_reference' && (
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 block">Key File Path (Reference Only)</label>
                  <button
                    type="button"
                    onClick={() => setShowKeyGenModal(true)}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate New Key Pair...</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. C:\Users\operator\.ssh\id_ed25519"
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[11px]"
                />
              </div>
            )}

            {authKind === 'vault_reference' && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 block font-medium">Select Saved Password from Vault</label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickTitle(displayName || 'Password for ' + (hostname || 'Host'));
                      setQuickUsername(username || 'root');
                      setShowQuickVaultAdd(!showQuickVaultAdd);
                    }}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showQuickVaultAdd ? 'Hide Quick Add' : 'New Vault Password'}</span>
                  </button>
                </div>

                {!showQuickVaultAdd ? (
                  vaultCredentials.length === 0 ? (
                    <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-amber-200/90 text-xs flex items-center justify-between">
                      <span>No saved passwords in your vault yet.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickTitle(displayName || 'Password for ' + (hostname || 'Host'));
                          setQuickUsername(username || 'root');
                          setShowQuickVaultAdd(true);
                        }}
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] cursor-pointer"
                      >
                        + Create First Entry
                      </button>
                    </div>
                  ) : (
                    <CustomSelect
                      value={selectedVaultId}
                      onChange={(val) => {
                        const id = String(val);
                        setSelectedVaultId(id);
                        const found = vaultCredentials.find((c) => c.id === id);
                        if (found) setAccountLabel(found.title);
                      }}
                      options={vaultCredentials.map((c) => ({
                        value: c.id,
                        label: `${c.title} (${c.username})`,
                        description: c.notes || `Saved credential for user ${c.username}`,
                        badge: 'Vault',
                        badgeVariant: 'amber',
                        dotColor: 'amber'
                      }))}
                    />
                  )
                ) : (
                  <div className="p-3 bg-slate-900 border border-amber-500/40 rounded-lg space-y-2.5">
                    <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Save New Password to Vault</span>
                    </div>

                    {quickError && (
                      <div className="text-red-400 text-[11px]">{quickError}</div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Ubuntu Bastion"
                          value={quickTitle}
                          onChange={(e) => setQuickTitle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">Username</label>
                        <input
                          type="text"
                          value={quickUsername}
                          onChange={(e) => setQuickUsername(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showQuickPass ? 'text' : 'password'}
                          placeholder="Password to encrypt"
                          value={quickPassword}
                          onChange={(e) => setQuickPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded pl-2 pr-7 py-1 text-slate-200 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowQuickPass(!showQuickPass)}
                          className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-200"
                        >
                          {showQuickPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowQuickVaultAdd(false)}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateQuickVault}
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium"
                      >
                        Save & Select
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tags and Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Tags (Comma-separated)</label>
              <input
                type="text"
                placeholder="prod, pci, web"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Keepalive Interval (seconds)</label>
              <input
                type="number"
                value={keepalive}
                onChange={(e) => setKeepalive(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Host Notes & Insights */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Host Notes & Comments (Insights)</span>
              </label>
              <span className="text-[10px] text-slate-500">Supports Markdown for easy recollection</span>
            </div>
            <textarea
              rows={3}
              placeholder="e.g. Host role, internal IPs, services, architecture quirks, DR instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Security Toggles (Disabled by Default) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <Shield className="w-4 h-4 text-amber-400" />
              Advanced Security & Forwarding
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agentForwarding}
                  onChange={(e) => setAgentForwarding(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500"
                />
                <span className="text-slate-300">Allow Agent Forwarding (Disabled by default per policy)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={x11Forwarding}
                  onChange={(e) => setX11Forwarding(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500"
                />
                <span className="text-slate-300">Allow X11 Forwarding (Disabled by default per policy)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-amber-500"
                />
                <span className="text-slate-300">Star as Favorite Session</span>
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-sm"
            >
              {isEditing ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </form>

        {showKeyGenModal && (
          <SSHKeyGeneratorModal
            onClose={() => setShowKeyGenModal(false)}
            onKeyGenerated={(kp) => {
              setAccountLabel(`${kp.type.toUpperCase()} Key (${kp.fingerprint.slice(0, 16)}...)`);
            }}
          />
        )}
      </div>
    </div>
  );
};
