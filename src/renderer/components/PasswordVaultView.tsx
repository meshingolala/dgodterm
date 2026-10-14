import React, { useState, useEffect, useRef } from 'react';
import { VaultCredential, ConnectionProfile } from '../../domain/types';
import {
  Key,
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit3,
  Trash2,
  Shield,
  Lock,
  Unlock,
  RefreshCw,
  Server,
  AlertCircle,
  X,
  FileText,
  Wand2,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Smartphone
} from 'lucide-react';

export const PasswordVaultView: React.FC = () => {
  // Master Password Auth States
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [vaultHint, setVaultHint] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Unlock Screen State
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const mfaInputRef = useRef<HTMLInputElement>(null);

  // First-time Setup Screen State
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [setupHint, setSetupHint] = useState('');
  const [showSetupPass, setShowSetupPass] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Change Master Password Modal State
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeCurrentPass, setChangeCurrentPass] = useState('');
  const [changeNewPass, setChangeNewPass] = useState('');
  const [changeConfirmPass, setChangeConfirmPass] = useState('');
  const [changeHint, setChangeHint] = useState('');
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState(false);

  // Vault Credentials State
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Visibility toggle per credential id
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  // Copied indicator per credential id
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit / Add modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<VaultCredential | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Delete confirm modal
  const [deletingCred, setDeletingCred] = useState<VaultCredential | null>(null);

  const unlockInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkMasterPasswordStatus();
  }, []);

  const checkMasterPasswordStatus = async () => {
    try {
      setCheckingAuth(true);
      const status = await (window as any).dgodterm.getVaultStatus?.();
      if (status) {
        setIsConfigured(status.isConfigured);
        setIsUnlocked(status.isUnlocked);
        setVaultHint(status.hint);
        if (status.isUnlocked) {
          loadVaultData();
        }
      } else {
        // Fallback if not configured
        setIsConfigured(false);
        setIsUnlocked(false);
      }
    } catch (err) {
      console.error('Failed to get vault status:', err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const [creds, profs] = await Promise.all([
        (window as any).dgodterm.getVaultCredentials(),
        (window as any).dgodterm.getProfiles()
      ]);
      setCredentials(creds || []);
      setProfiles(profs || []);
    } catch (err) {
      console.error('Failed to load password vault:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Unlock
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword) {
      setUnlockError('Please enter your Master Password.');
      return;
    }
    if (requiresMfa && !mfaToken) {
      setUnlockError('Please enter your 6-digit Google Authenticator code.');
      mfaInputRef.current?.focus();
      return;
    }
    try {
      setIsUnlocking(true);
      setUnlockError('');
      const res = await (window as any).dgodterm.unlockVault(unlockPassword, mfaToken);
      const isSuccess = typeof res === 'boolean' ? res : res?.success;
      if (isSuccess) {
        setIsUnlocked(true);
        setUnlockPassword('');
        setMfaToken('');
        setRequiresMfa(false);
        loadVaultData();
      } else if (res?.requiresMfa) {
        setRequiresMfa(true);
        if (mfaToken) {
          setUnlockError(res.error || 'Invalid Google Authenticator code. Check time sync on your device.');
        } else {
          setUnlockError(''); // Master password verified successfully; ready for MFA
        }
        setTimeout(() => mfaInputRef.current?.focus(), 100);
      } else {
        setUnlockError((typeof res === 'object' && res?.error) || 'Incorrect Master Password. Please try again.');
        setRequiresMfa(false);
      }
    } catch (err: any) {
      setUnlockError(err.message || 'Failed to unlock vault');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle Initial Master Password Setup
  const handleSetupMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterPassword || newMasterPassword.length < 4) {
      setSetupError('Master password must be at least 4 characters long.');
      return;
    }
    if (newMasterPassword !== confirmMasterPassword) {
      setSetupError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setIsSettingUp(true);
      setSetupError('');
      await (window as any).dgodterm.setupVaultMaster(newMasterPassword, setupHint);
      setIsConfigured(true);
      setIsUnlocked(true);
      setVaultHint(setupHint || null);
      loadVaultData();
    } catch (err: any) {
      setSetupError(err.message || 'Failed to configure master password.');
    } finally {
      setIsSettingUp(false);
    }
  };

  // Handle Lock Vault
  const handleLockVault = async () => {
    try {
      await (window as any).dgodterm.lockVault?.();
      setIsUnlocked(false);
      setRevealedIds({});
      setUnlockPassword('');
      setUnlockError('');
    } catch (err) {
      console.error('Failed to lock vault:', err);
    }
  };

  // Handle Change Master Password
  const handleChangeMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeCurrentPass) {
      setChangeError('Current master password is required.');
      return;
    }
    if (!changeNewPass || changeNewPass.length < 4) {
      setChangeError('New password must be at least 4 characters long.');
      return;
    }
    if (changeNewPass !== changeConfirmPass) {
      setChangeError('New passwords do not match.');
      return;
    }

    try {
      const isCurrentValid = await (window as any).dgodterm.unlockVault(changeCurrentPass);
      if (!isCurrentValid) {
        setChangeError('Current master password is incorrect.');
        return;
      }

      await (window as any).dgodterm.setupVaultMaster(changeNewPass, changeHint);
      setVaultHint(changeHint || null);
      setChangeSuccess(true);
      setTimeout(() => {
        setChangeModalOpen(false);
        setChangeSuccess(false);
        setChangeCurrentPass('');
        setChangeNewPass('');
        setChangeConfirmPass('');
        setChangeHint('');
        setChangeError('');
      }, 1500);
    } catch (err: any) {
      setChangeError(err.message || 'Failed to update master password');
    }
  };

  const handleOpenAdd = () => {
    setEditingCred(null);
    setFormTitle('');
    setFormUsername('');
    setFormPassword('');
    setFormNotes('');
    setFormError('');
    setShowFormPassword(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (cred: VaultCredential) => {
    setEditingCred(cred);
    setFormTitle(cred.title);
    setFormUsername(cred.username);
    setFormPassword(cred.password || '');
    setFormNotes(cred.notes || '');
    setFormError('');
    setShowFormPassword(false);
    setModalOpen(true);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,.-=';
    let generated = '';
    const array = new Uint32Array(20);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 20; i++) {
      generated += chars[array[i] % chars.length];
    }
    setFormPassword(generated);
    setShowFormPassword(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!formUsername.trim()) {
      setFormError('Username is required.');
      return;
    }
    if (!editingCred && !formPassword) {
      setFormError('Password is required for new vault entries.');
      return;
    }

    try {
      await (window as any).dgodterm.saveVaultCredential({
        id: editingCred?.id,
        title: formTitle.trim(),
        username: formUsername.trim(),
        password: formPassword,
        notes: formNotes.trim() || undefined
      });
      setModalOpen(false);
      loadVaultData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save credential');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await (window as any).dgodterm.deleteVaultCredential(id);
      setDeletingCred(null);
      loadVaultData();
    } catch (err) {
      console.error('Failed to delete vault credential:', err);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const filteredCredentials = credentials.filter((c) => {
    const query = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(query) ||
      c.username.toLowerCase().includes(query) ||
      (c.notes && c.notes.toLowerCase().includes(query))
    );
  });

  // 1. Loading screen
  if (checkingAuth) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs font-mono">Verifying Password Vault security state...</p>
      </div>
    );
  }

  // 2. Setup Master Password Screen (If not configured yet)
  if (!isConfigured) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center space-y-2">
            <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10 mb-2">
              <KeyRound className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Set Up Vault Master Password
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Create a Master Password to protect your saved login credentials. This master password will be required to unlock and view the vault.
            </p>
          </div>

          <form onSubmit={handleSetupMaster} className="space-y-4 text-xs">
            {setupError && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            <div>
              <label className="text-slate-300 block mb-1 font-medium">New Master Password *</label>
              <div className="relative">
                <input
                  type={showSetupPass ? 'text' : 'password'}
                  placeholder="Enter strong master password"
                  value={newMasterPassword}
                  onChange={(e) => setNewMasterPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowSetupPass(!showSetupPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showSetupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">Confirm Master Password *</label>
              <input
                type={showSetupPass ? 'text' : 'password'}
                placeholder="Re-enter master password"
                value={confirmMasterPassword}
                onChange={(e) => setConfirmMasterPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Password Hint (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Favorite childhood pet + year"
                value={setupHint}
                onChange={(e) => setSetupHint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSettingUp}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isSettingUp ? 'Encrypting & Initializing...' : 'Set Master Password & Open Vault'}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5 pt-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Protected with PBKDF2-SHA512 + AES-256-GCM encryption</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3. Unlock Master Password Screen (If configured but locked)
  if (!isUnlocked) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-amber-500/30 rounded-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center space-y-2">
            <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/15 mb-2">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Password Vault is Locked
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your Master Password to decrypt and view saved server credentials.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4 text-xs">
            {unlockError && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium flex items-center gap-1.5">
                  Master Password
                  {requiresMfa && (
                    <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Verified
                    </span>
                  )}
                </label>
                {vaultHint && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1" title={vaultHint}>
                    <HelpCircle className="w-3 h-3 text-slate-400" />
                    <span>Hint: {vaultHint}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  ref={unlockInputRef}
                  type={showUnlockPass ? 'text' : 'password'}
                  placeholder="Enter Master Password"
                  value={unlockPassword}
                  onChange={(e) => {
                    setUnlockPassword(e.target.value);
                    if (requiresMfa) {
                      setRequiresMfa(false);
                      setMfaToken('');
                      setUnlockError('');
                    }
                  }}
                  className={`w-full bg-slate-950 border ${requiresMfa ? 'border-emerald-500/50' : 'border-slate-700'} rounded-lg pl-3 pr-10 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-xs`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPass(!showUnlockPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showUnlockPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Google Authenticator (2FA) Input: rendered when master password is verified */}
            {requiresMfa && (
              <div className="p-3.5 bg-slate-950 border border-emerald-500/40 rounded-xl space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    Google Authenticator Code (2FA)
                  </label>
                  <span className="text-[10px] text-emerald-500 font-mono">6 Digits</span>
                </div>
                <input
                  ref={mfaInputRef}
                  type="text"
                  maxLength={6}
                  placeholder="000 000"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-center text-sm font-mono tracking-widest text-emerald-300 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 text-center">
                  Open Google Authenticator on your mobile phone and enter the 6-digit code.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isUnlocking}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>
                {isUnlocking
                  ? 'Verifying...'
                  : (requiresMfa ? 'Verify 2FA & Unlock Vault' : 'Unlock Password Vault')}
              </span>
            </button>

            <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>AES-256-GCM Hardware Encrypted</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 4. Unlocked View
  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">Password Vault</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  AES-256-GCM
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Master Key Protected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage saved login passwords. Use them seamlessly across SSH terminal sessions and SFTP connections.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setChangeModalOpen(true)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer text-xs flex items-center gap-1.5"
              title="Change Master Password"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Change Master Password</span>
            </button>

            <button
              onClick={handleLockVault}
              className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-200 border border-red-500/40 transition cursor-pointer text-xs flex items-center gap-1.5 shadow-sm"
              title="Lock Vault Now"
            >
              <Lock className="w-3.5 h-3.5 text-red-400" />
              <span>Lock Vault</span>
            </button>

            <button
              onClick={loadVaultData}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
              title="Refresh Vault"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-lg shadow-amber-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Password</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Summary */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search title, username, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/80 transition"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 self-end sm:self-auto font-mono">
            <span>
              Total Saved:{' '}
              <strong className="text-amber-400">{credentials.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && credentials.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs">Decrypting and loading password vault...</p>
          </div>
        ) : filteredCredentials.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto mt-12 bg-slate-900/20">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Key className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {search ? 'No matching passwords found' : 'Your Password Vault is Empty'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              {search
                ? `No vault credentials match "${search}". Try adjusting your query.`
                : 'Save passwords here once, then assign them to any SSH or SFTP connection profile for seamless zero-prompt authentication.'}
            </p>
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium transition cursor-pointer"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs text-white font-medium shadow-lg shadow-amber-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Your First Password</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCredentials.map((cred) => {
              const isRevealed = Boolean(revealedIds[cred.id]);
              const isCopied = copiedId === cred.id;
              const associatedProfiles = profiles.filter(
                (p) =>
                  p.auth_reference?.kind === 'vault_reference' &&
                  p.auth_reference.reference_id === cred.id
              );

              return (
                <div
                  key={cred.id}
                  className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 flex flex-col justify-between transition group shadow-sm hover:shadow-md hover:shadow-black/40"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition">
                            {cred.title}
                          </h3>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            user: <span className="text-slate-300">{cred.username}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEdit(cred)}
                          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                          title="Edit Password"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingCred(cred)}
                          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-red-400 transition cursor-pointer"
                          title="Delete Password"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between gap-2">
                      <div className="font-mono text-xs text-slate-200 truncate select-all flex-1 px-1">
                        {isRevealed ? (
                          cred.password || '••••••••'
                        ) : (
                          <span className="tracking-widest text-slate-500 font-sans">
                            ••••••••••••
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleReveal(cred.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                          title={isRevealed ? 'Hide Password' : 'Show Password'}
                        >
                          {isRevealed ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleCopy(cred.id, cred.password || '')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer relative"
                          title="Copy Password to Clipboard"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Notes */}
                    {cred.notes && (
                      <div className="text-[11px] text-slate-400 bg-slate-950/40 rounded px-2.5 py-1.5 border border-slate-800/50 flex items-start gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{cred.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer / Associated Profiles */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3 h-3 text-slate-400" />
                      <span>
                        {associatedProfiles.length > 0 ? (
                          <span className="text-slate-300 font-medium">
                            Linked to {associatedProfiles.length} profile
                            {associatedProfiles.length === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="text-slate-500">Not linked to profiles</span>
                        )}
                      </span>
                    </div>

                    <span className="font-mono text-[10px] text-slate-600">
                      {new Date(cred.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Change Master Password Modal */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Change Master Password</h3>
              </div>
              <button
                onClick={() => setChangeModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangeMasterPassword} className="p-5 space-y-3.5 text-xs">
              {changeSuccess ? (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-lg text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Master password updated successfully!</span>
                </div>
              ) : null}

              {changeError && (
                <div className="p-2.5 bg-red-950/60 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{changeError}</span>
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1">Current Master Password *</label>
                <input
                  type="password"
                  value={changeCurrentPass}
                  onChange={(e) => setChangeCurrentPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">New Master Password *</label>
                <input
                  type="password"
                  placeholder="At least 4 characters"
                  value={changeNewPass}
                  onChange={(e) => setChangeNewPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Confirm New Master Password *</label>
                <input
                  type="password"
                  value={changeConfirmPass}
                  onChange={(e) => setChangeConfirmPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Password Hint (Optional)</label>
                <input
                  type="text"
                  placeholder="Optional hint"
                  value={changeHint}
                  onChange={(e) => setChangeHint(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  Update Master Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Credential Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {editingCred ? 'Edit Saved Password' : 'Add New Password to Vault'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 bg-red-950/60 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1">Title / Identifier *</label>
                <input
                  type="text"
                  placeholder="e.g. Production Bastion Root or Web Cluster Ubuntu"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Username *</label>
                <input
                  type="text"
                  placeholder="e.g. root, ubuntu, or admin"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">
                    Password {editingCred ? '(Leave blank to keep existing)' : '*'}
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Generate Strong</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    placeholder={editingCred ? '•••••••••••• (Unchanged)' : 'Enter password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-9 py-2 text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Optional context, rotation schedule, or details"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  {editingCred ? 'Save Changes' : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-red-500/40 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">Delete Vault Password?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">"{deletingCred.title}"</strong> ({deletingCred.username})? Any profiles referencing this saved credential will prompt for password on connection.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingCred(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingCred.id)}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium shadow-md shadow-red-600/20 transition cursor-pointer"
              >
                Delete Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
