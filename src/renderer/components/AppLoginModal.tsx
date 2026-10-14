import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  QrCode,
  Smartphone,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  LogOut,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  X
} from 'lucide-react';
import { QrCanvas } from './QrCanvas';

interface AppLoginModalProps {
  onAuthenticated: () => void;
}

export const AppLoginModal: React.FC<AppLoginModalProps> = ({ onAuthenticated }) => {
  const [authStatus, setAuthStatus] = useState<{
    isConfigured: boolean;
    isUnlocked: boolean;
    hint: string | null;
    mfaEnabled: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  // Login form state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [requiresMfaStep, setRequiresMfaStep] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // First time setup state
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupHint, setSetupHint] = useState('');
  const [enableMfaOnSetup, setEnableMfaOnSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [setupMfaToken, setSetupMfaToken] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Inline Google MFA Pairing Modal (for existing accounts where MFA wasn't configured yet)
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairPassword, setPairPassword] = useState('');
  const [pairToken, setPairToken] = useState('');
  const [pairSetupData, setPairSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [pairError, setPairError] = useState('');
  const [pairSuccess, setPairSuccess] = useState(false);
  const [isPairingSubmitting, setIsPairingSubmitting] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const mfaInputRef = useRef<HTMLInputElement>(null);
  const pairTokenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const status = await (window as any).dgodterm.getVaultStatus();
      setAuthStatus(status);

      // Only bypass if both unlocked in-memory AND current window session is authenticated
      if (status && !status.isConfigured) {
        // Will show first time setup
      } else if (status?.isUnlocked && sessionStorage.getItem('dgodterm_session_auth') === 'true') {
        onAuthenticated();
      }
    } catch (e) {
      console.error('Failed to get auth status:', e);
    } finally {
      setLoading(false);
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  };

  const handleStartMfaSetup = async () => {
    try {
      const data = await (window as any).dgodterm.setupMfa();
      setMfaSetupData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize MFA');
    }
  };

  const handleOpenPairModal = async () => {
    setPairError('');
    setPairToken('');
    setPairSuccess(false);
    setPairPassword(password); // Pre-fill with whatever was already entered
    try {
      const data = await (window as any).dgodterm.setupMfa();
      setPairSetupData(data);
      setShowPairModal(true);
      setTimeout(() => pairTokenInputRef.current?.focus(), 200);
    } catch (err: any) {
      setError(err.message || 'Failed to generate MFA secret');
    }
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairError('');

    if (!pairPassword) {
      setPairError('Please enter your workstation master password.');
      return;
    }
    if (!pairToken || pairToken.length !== 6) {
      setPairError('Please enter the 6-digit code shown in Google Authenticator.');
      return;
    }
    if (!pairSetupData?.secret) {
      setPairError('MFA setup session expired. Please reopen.');
      return;
    }

    try {
      setIsPairingSubmitting(true);
      // 1. Verify password first
      const pwCheck = await (window as any).dgodterm.unlockVault(pairPassword);
      if (!pwCheck.success && !pwCheck.requiresMfa) {
        setPairError(pwCheck.error || 'Incorrect master password.');
        return;
      }

      // 2. Enable MFA
      const mfaRes = await (window as any).dgodterm.enableMfa(pairSetupData.secret, pairToken);
      if (!mfaRes.success) {
        setPairError(mfaRes.error || 'Invalid 6-digit code. Check your device clock time synchronization.');
        return;
      }

      setPairSuccess(true);
      sessionStorage.setItem('dgodterm_session_auth', 'true');

      // Refresh auth status
      const updatedStatus = await (window as any).dgodterm.getVaultStatus();
      setAuthStatus(updatedStatus);

      setTimeout(() => {
        setShowPairModal(false);
        onAuthenticated();
      }, 1200);
    } catch (err: any) {
      setPairError(err.message || 'Failed to enable Google MFA');
    } finally {
      setIsPairingSubmitting(false);
    }
  };

  const handleInitialSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!setupPassword || setupPassword.length < 6) {
      setError('Master workstation password must be at least 6 characters.');
      return;
    }
    if (setupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (enableMfaOnSetup) {
      if (!mfaSetupData || !setupMfaToken) {
        setError('Please enter the 6-digit code from Google Authenticator to verify setup.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      // 1. Setup master password
      const ok = await (window as any).dgodterm.setupVaultMaster(setupPassword, setupHint);
      if (!ok) {
        throw new Error('Failed to create master vault password.');
      }

      // 2. Enable MFA if requested
      if (enableMfaOnSetup && mfaSetupData) {
        const mfaRes = await (window as any).dgodterm.enableMfa(mfaSetupData.secret, setupMfaToken);
        if (!mfaRes.success) {
          throw new Error(mfaRes.error || 'Failed to verify Google MFA code.');
        }
      }

      sessionStorage.setItem('dgodterm_session_auth', 'true');
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || 'Setup error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter your workstation password.');
      passwordInputRef.current?.focus();
      return;
    }

    // If already on the MFA step, require the 6-digit code
    if (requiresMfaStep && !mfaToken) {
      setError('Please enter your 6-digit Google Authenticator code.');
      setTimeout(() => mfaInputRef.current?.focus(), 100);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await (window as any).dgodterm.unlockVault(password, mfaToken);

      if (res.success) {
        sessionStorage.setItem('dgodterm_session_auth', 'true');
        onAuthenticated();
      } else if (res.requiresMfa) {
        setRequiresMfaStep(true);
        if (mfaToken) {
          setError(res.error || 'Invalid Google Authenticator code. Check time sync on your device.');
        } else {
          setError(''); // Password verified successfully; ready for MFA
        }
        setTimeout(() => mfaInputRef.current?.focus(), 100);
      } else {
        setError(res.error || 'Invalid master password.');
        setRequiresMfaStep(false);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySecret = (sec: string) => {
    if (!sec) return;
    navigator.clipboard.writeText(sec);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090d16] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-mono">Securing Workstation Environment...</span>
        </div>
      </div>
    );
  }

  // First-time configuration screen
  if (authStatus && !authStatus.isConfigured) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-7 flex flex-col space-y-5 my-8">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-400 border border-sky-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Setup Workstation Security
              </h2>
              <p className="text-xs text-slate-400">
                Create a master password to protect your SSH keys, credentials, and servers.
              </p>
            </div>
          </div>

          <form onSubmit={handleInitialSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Workstation Master Password (Min 6 chars)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter strong password..."
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirm Master Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-type password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password Hint (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Favorite datacenter rack name"
                value={setupHint}
                onChange={(e) => setSetupHint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Google MFA Toggle */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableMfaOnSetup}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnableMfaOnSetup(checked);
                    if (checked && !mfaSetupData) {
                      handleStartMfaSetup();
                    }
                  }}
                  className="rounded border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 bg-slate-950"
                />
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Enable Google Authenticator (MFA / 2FA)
                </span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1 pl-6">
                Requires a 6-digit TOTP verification code each time you launch or unlock DgodTerm.
              </p>

              {enableMfaOnSetup && mfaSetupData && (
                <div className="mt-3 p-4 bg-slate-950/80 border border-emerald-500/30 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <QrCode className="w-4 h-4" />
                    Scan QR with Google Authenticator or 2FA App
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 justify-center py-2">
                    <QrCanvas text={mfaSetupData.otpauthUrl} size={150} />

                    <div className="space-y-2 flex-1 text-center sm:text-left">
                      <div className="text-[11px] text-slate-400">
                        Or enter this manual secret key in your authenticator app:
                      </div>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded p-1.5 font-mono text-[11px] text-emerald-300">
                        <span className="flex-1 truncate select-all">{mfaSetupData.secret}</span>
                        <button
                          type="button"
                          onClick={() => handleCopySecret(mfaSetupData.secret)}
                          className="p-1 hover:text-white"
                          title="Copy key"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Enter 6-digit Authenticator Code to verify:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={setupMfaToken}
                      onChange={(e) => setSetupMfaToken(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-center text-sm font-mono tracking-widest text-emerald-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? 'Configuring Secure Workstation...' : 'Initialize & Enter DgodTerm'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Standard Login / Unlock Screen
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c1220] shadow-2xl p-8 flex flex-col space-y-6 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent blur-sm" />

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            DgodTerm Workstation
          </h2>
          <p className="text-xs text-slate-400">
            Enterprise Linux Fleet & SSH Workstation Authentication
          </p>
        </div>

        {/* Google MFA Status Header Badge */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Smartphone className={`w-3.5 h-3.5 ${authStatus?.mfaEnabled ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>Google MFA:</span>
            {authStatus?.mfaEnabled ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Enabled
              </span>
            ) : (
              <span className="text-amber-400 font-semibold">Not Configured</span>
            )}
          </div>

          {!authStatus?.mfaEnabled && (
            <button
              type="button"
              onClick={handleOpenPairModal}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition cursor-pointer"
            >
              + Set Up MFA
            </button>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                Workstation Password
                {requiresMfaStep && (
                  <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Verified
                  </span>
                )}
              </span>
              {authStatus?.hint && (
                <span className="text-[10px] text-slate-500 font-normal">
                  Hint: {authStatus.hint}
                </span>
              )}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter master password..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (requiresMfaStep) {
                    setRequiresMfaStep(false);
                    setMfaToken('');
                    setError('');
                  }
                }}
                className={`w-full bg-slate-950/80 border ${requiresMfaStep ? 'border-emerald-500/50' : 'border-slate-700/80'} rounded-xl pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono transition`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* MFA input: rendered only when master password entered is verified and MFA is required */}
          {requiresMfaStep && (
            <div className="p-3.5 bg-slate-950/80 border border-emerald-500/30 rounded-xl space-y-2 animate-fadeIn">
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
              />
              <p className="text-[11px] text-slate-400 text-center">
                Open Google Authenticator on your mobile phone and enter the 6-digit code.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            {isSubmitting
              ? (requiresMfaStep ? 'Verifying MFA...' : 'Verifying Password...')
              : (requiresMfaStep
                  ? 'Verify Password & MFA to Unlock'
                  : (authStatus?.mfaEnabled ? 'Continue' : 'Unlock & Sign In'))}
          </button>
        </form>

        {/* Option to pair Google MFA if not configured yet */}
        {!authStatus?.mfaEnabled && (
          <div className="p-3 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl flex items-center justify-between gap-3">
            <div className="text-left">
              <div className="text-xs font-medium text-slate-300">Need Google MFA enabled?</div>
              <div className="text-[11px] text-slate-500">Add two-factor TOTP protection now</div>
            </div>
            <button
              type="button"
              onClick={handleOpenPairModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Pair Google MFA</span>
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 text-center text-[11px] text-slate-500">
          AES-256-GCM Zero-Knowledge Storage Policy | ISO 27001 Ready
        </div>
      </div>

      {/* Google MFA Pairing Modal Dialog */}
      {showPairModal && pairSetupData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl p-6 flex flex-col space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Enable Google Authenticator (MFA)</h3>
              </div>
              <button
                onClick={() => setShowPairModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Scan this QR code with <strong>Google Authenticator</strong> (or Microsoft Authenticator) on your phone, then enter your master password and the generated 6-digit code.
            </p>

            {/* QR Code Canvas */}
            <div className="flex flex-col items-center justify-center py-2 space-y-3">
              <QrCanvas text={pairSetupData.otpauthUrl} size={160} />

              <div className="w-full space-y-1 text-center">
                <div className="text-[11px] text-slate-400">Manual secret entry code:</div>
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-1.5 font-mono text-[11px] text-emerald-300">
                  <span className="flex-1 truncate select-all">{pairSetupData.secret}</span>
                  <button
                    type="button"
                    onClick={() => handleCopySecret(pairSetupData.secret)}
                    className="p-1 hover:text-white cursor-pointer"
                    title="Copy secret key"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handlePairSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Workstation Master Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your master password..."
                  value={pairPassword}
                  onChange={(e) => setPairPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-400 mb-1">
                  6-Digit Authenticator Code
                </label>
                <input
                  ref={pairTokenInputRef}
                  type="text"
                  maxLength={6}
                  placeholder="000 000"
                  value={pairToken}
                  onChange={(e) => setPairToken(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center text-sm font-mono tracking-widest text-emerald-300 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {pairError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{pairError}</span>
                </div>
              )}

              {pairSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Google MFA successfully activated! Signing in...</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPairModal(false)}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPairingSubmitting || !pairPassword || pairToken.length !== 6}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isPairingSubmitting ? 'Verifying...' : 'Activate Google MFA'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
