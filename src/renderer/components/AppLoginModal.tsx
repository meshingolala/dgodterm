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

  useEffect(() => {
    if (!loading && authStatus) {
      setTimeout(() => passwordInputRef.current?.focus(), 80);
    }
  }, [loading, authStatus]);

  useEffect(() => {
    if (requiresMfaStep) {
      setTimeout(() => mfaInputRef.current?.focus(), 80);
    }
  }, [requiresMfaStep]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const status = await (window as any).dgodterm.getVaultStatus();
      if (status) {
        setAuthStatus(status);
        if (status.isUnlocked && sessionStorage.getItem('dgodterm_session_auth') === 'true') {
          onAuthenticated();
          return;
        }
      }
    } catch (e) {
      console.error('Failed to get auth status:', e);
    } finally {
      setLoading(false);
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


  if (loading || !authStatus) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      >
        <div
          className="flex flex-col items-center gap-3 p-6 rounded-2xl shadow-xl"
          style={{
            backgroundColor: 'var(--dgod-bg-surface)',
            border: '1px solid var(--dgod-border-strong)',
            color: 'var(--dgod-text-primary)'
          }}
        >
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--dgod-accent)', borderTopColor: 'transparent' }}
          />
          <span className="text-xs font-mono tracking-wider" style={{ color: 'var(--dgod-text-secondary)' }}>
            Securing Workstation Environment...
          </span>
        </div>
      </div>
    );
  }

  // First-time configuration screen
  if (authStatus && !authStatus.isConfigured) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
      >
        <div
          className="w-full max-w-lg rounded-2xl shadow-2xl p-7 flex flex-col space-y-5 my-8 transition-all"
          style={{
            backgroundColor: 'var(--dgod-bg-surface)',
            border: '1px solid var(--dgod-border-strong)',
            color: 'var(--dgod-text-primary)',
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.25), 0 0 1px 1px var(--dgod-border)'
          }}
        >
          <div
            className="flex items-center gap-3 pb-3 border-b"
            style={{ borderColor: 'var(--dgod-border)' }}
          >
            <div
              className="p-2.5 rounded-xl shadow-inner"
              style={{
                backgroundColor: 'var(--dgod-accent-subtle)',
                color: 'var(--dgod-accent)',
                border: '1px solid var(--dgod-accent)'
              }}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--dgod-text-primary)' }}>
                Setup Workstation Security
              </h2>
              <p className="text-xs" style={{ color: 'var(--dgod-text-secondary)' }}>
                Create a master password to protect your SSH keys, credentials, and servers.
              </p>
            </div>
          </div>

          <form onSubmit={handleInitialSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dgod-text-primary)' }}>
                Workstation Master Password (Min 6 chars)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5" style={{ color: 'var(--dgod-text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter strong password..."
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full rounded-lg pl-9 pr-9 py-2 text-xs font-mono focus:outline-none transition"
                  style={{
                    backgroundColor: 'var(--dgod-bg-sidebar)',
                    border: '1px solid var(--dgod-border-strong)',
                    color: 'var(--dgod-text-primary)'
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 transition"
                  style={{ color: 'var(--dgod-text-muted)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dgod-text-primary)' }}>
                Confirm Master Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5" style={{ color: 'var(--dgod-text-muted)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-type password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg pl-9 pr-3 py-2 text-xs font-mono focus:outline-none transition"
                  style={{
                    backgroundColor: 'var(--dgod-bg-sidebar)',
                    border: '1px solid var(--dgod-border-strong)',
                    color: 'var(--dgod-text-primary)'
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--dgod-text-primary)' }}>
                Password Hint (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Favorite datacenter rack name"
                value={setupHint}
                onChange={(e) => setSetupHint(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition"
                style={{
                  backgroundColor: 'var(--dgod-bg-sidebar)',
                  border: '1px solid var(--dgod-border-strong)',
                  color: 'var(--dgod-text-primary)'
                }}
              />
            </div>

            {/* Google MFA Toggle */}
            <div className="pt-2 border-t" style={{ borderColor: 'var(--dgod-border)' }}>
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
                  className="rounded w-4 h-4"
                  style={{ accentColor: 'var(--dgod-accent)' }}
                />
                <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--dgod-text-primary)' }}>
                  <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Enable Google Authenticator (MFA / 2FA)
                </span>
              </label>
              <p className="text-[11px] mt-1 pl-6" style={{ color: 'var(--dgod-text-secondary)' }}>
                Requires a 6-digit TOTP verification code each time you launch or unlock DgodTerm.
              </p>

              {enableMfaOnSetup && mfaSetupData && (
                <div
                  className="mt-3 p-4 rounded-xl space-y-3"
                  style={{
                    backgroundColor: 'var(--dgod-bg-sidebar)',
                    border: '1px solid var(--dgod-border-strong)'
                  }}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <QrCode className="w-4 h-4" />
                    Scan QR with Google Authenticator or 2FA App
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 justify-center py-2">
                    <QrCanvas text={mfaSetupData.otpauthUrl} size={150} />

                    <div className="space-y-2 flex-1 text-center sm:text-left">
                      <div className="text-[11px]" style={{ color: 'var(--dgod-text-secondary)' }}>
                        Or enter this manual secret key in your authenticator app:
                      </div>
                      <div
                        className="flex items-center gap-1 rounded p-1.5 font-mono text-[11px]"
                        style={{
                          backgroundColor: 'var(--dgod-bg-surface-elevated)',
                          border: '1px solid var(--dgod-border-strong)',
                          color: 'var(--dgod-text-primary)'
                        }}
                      >
                        <span className="flex-1 truncate select-all">{mfaSetupData.secret}</span>
                        <button
                          type="button"
                          onClick={() => handleCopySecret(mfaSetupData.secret)}
                          className="p-1 cursor-pointer"
                          style={{ color: 'var(--dgod-text-muted)' }}
                          title="Copy key"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--dgod-text-primary)' }}>
                      Enter 6-digit Authenticator Code to verify:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={setupMfaToken}
                      onChange={(e) => setSetupMfaToken(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-lg p-2 text-center text-sm font-mono tracking-widest focus:outline-none"
                      style={{
                        backgroundColor: 'var(--dgod-bg-surface-elevated)',
                        border: '1px solid var(--dgod-border-strong)',
                        color: 'var(--dgod-text-primary)'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md active:scale-[0.99]"
              style={{
                backgroundColor: 'var(--dgod-accent)',
                color: '#ffffff'
              }}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col space-y-6 relative overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: 'var(--dgod-bg-surface)',
          border: '1px solid var(--dgod-border-strong)',
          color: 'var(--dgod-text-primary)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 1px 1px var(--dgod-border)'
        }}
      >
        {/* Glow accent */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 blur-sm"
          style={{
            background: 'linear-gradient(to right, transparent, var(--dgod-accent), transparent)'
          }}
        />

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div
            className="inline-flex p-3 rounded-2xl shadow-inner transition-transform"
            style={{
              backgroundColor: 'var(--dgod-accent-subtle)',
              color: 'var(--dgod-accent)',
              border: '1px solid var(--dgod-accent)'
            }}
          >
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--dgod-text-primary)' }}>
            DgodTerm Workstation
          </h2>
          <p className="text-xs" style={{ color: 'var(--dgod-text-secondary)' }}>
            Enterprise Linux Fleet & SSH Workstation Authentication
          </p>
        </div>

        {/* Google MFA Status Header Badge */}
        <div
          className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs"
          style={{
            backgroundColor: 'var(--dgod-bg-surface-elevated)',
            border: '1px solid var(--dgod-border)',
            color: 'var(--dgod-text-secondary)'
          }}
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" style={{ color: authStatus?.mfaEnabled ? '#10b981' : 'var(--dgod-accent)' }} />
            <span className="font-medium">Google MFA:</span>
            {authStatus?.mfaEnabled ? (
              <span className="font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Enabled
              </span>
            ) : (
              <span className="font-semibold text-amber-600 dark:text-amber-400">Not Configured</span>
            )}
          </div>

          {!authStatus?.mfaEnabled && (
            <button
              type="button"
              onClick={handleOpenPairModal}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer"
              style={{
                backgroundColor: 'var(--dgod-accent-subtle)',
                color: 'var(--dgod-accent)',
                border: '1px solid var(--dgod-accent)'
              }}
            >
              + Set Up MFA
            </button>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 flex items-center justify-between" style={{ color: 'var(--dgod-text-primary)' }}>
              <span className="flex items-center gap-1.5">
                Workstation Password
                {requiresMfaStep && (
                  <span className="text-[10px] font-normal flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3 h-3" /> Password Verified
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {requiresMfaStep && (
                  <button
                    type="button"
                    onClick={() => {
                      setRequiresMfaStep(false);
                      setMfaToken('');
                      setError('');
                      setTimeout(() => passwordInputRef.current?.focus(), 50);
                    }}
                    className="text-[10px] underline cursor-pointer"
                    style={{ color: 'var(--dgod-accent)' }}
                  >
                    Edit password
                  </button>
                )}
                {authStatus?.hint && (
                  <span className="text-[10px] font-normal" style={{ color: 'var(--dgod-text-muted)' }}>
                    Hint: {authStatus.hint}
                  </span>
                )}
              </div>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3" style={{ color: 'var(--dgod-text-muted)' }} />
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter master password..."
                value={password}
                disabled={isSubmitting || requiresMfaStep}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (requiresMfaStep) {
                    setRequiresMfaStep(false);
                    setMfaToken('');
                    setError('');
                  }
                }}
                className="w-full rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono transition focus:outline-none"
                style={{
                  backgroundColor: 'var(--dgod-bg-sidebar)',
                  border: requiresMfaStep ? '1px solid #10b981' : '1px solid var(--dgod-border-strong)',
                  color: 'var(--dgod-text-primary)',
                  opacity: requiresMfaStep ? 0.75 : 1
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 transition cursor-pointer"
                style={{ color: 'var(--dgod-text-muted)' }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* MFA input: rendered only when master password entered is verified and MFA is required */}
          {requiresMfaStep && (
            <div
              className="p-4 rounded-xl space-y-2 animate-fadeIn"
              style={{
                backgroundColor: 'var(--dgod-bg-sidebar)',
                border: '1px solid rgba(16, 185, 129, 0.4)'
              }}
            >
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                  Google Authenticator Code (2FA)
                </label>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">6 Digits</span>
              </div>
              <input
                ref={mfaInputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000 000"
                value={mfaToken}
                disabled={isSubmitting}
                autoFocus
                onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg p-2.5 text-center text-sm font-mono tracking-widest focus:outline-none"
                style={{
                  backgroundColor: 'var(--dgod-bg-surface)',
                  border: '1px solid #10b981',
                  color: 'var(--dgod-text-primary)'
                }}
              />
              <p className="text-[11px] text-center" style={{ color: 'var(--dgod-text-secondary)' }}>
                Open Google Authenticator on your mobile phone and enter the 6-digit code.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password || (requiresMfaStep && mfaToken.length !== 6)}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md active:scale-[0.99]"
            style={{
              backgroundColor: 'var(--dgod-accent)',
              color: '#ffffff'
            }}
          >
            <ShieldCheck className="w-4 h-4" />
            {isSubmitting
              ? (requiresMfaStep ? 'Verifying 2FA Code...' : 'Verifying Password...')
              : (requiresMfaStep
                  ? 'Verify 2FA & Unlock'
                  : (authStatus?.mfaEnabled ? 'Continue to 2FA' : 'Unlock & Sign In'))}
          </button>
        </form>

        {/* Option to pair Google MFA if not configured yet */}
        {!authStatus?.mfaEnabled && (
          <div
            className="p-3 rounded-xl flex items-center justify-between gap-3 border border-dashed"
            style={{
              backgroundColor: 'var(--dgod-bg-surface-elevated)',
              borderColor: 'var(--dgod-border-strong)'
            }}
          >
            <div className="text-left">
              <div className="text-xs font-medium" style={{ color: 'var(--dgod-text-primary)' }}>Need Google MFA enabled?</div>
              <div className="text-[11px]" style={{ color: 'var(--dgod-text-secondary)' }}>Add two-factor TOTP protection now</div>
            </div>
            <button
              type="button"
              onClick={handleOpenPairModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
              style={{
                backgroundColor: 'var(--dgod-accent-subtle)',
                color: 'var(--dgod-accent)',
                border: '1px solid var(--dgod-accent)'
              }}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Pair Google MFA</span>
            </button>
          </div>
        )}

        <div
          className="pt-2 border-t text-center text-[11px]"
          style={{
            borderColor: 'var(--dgod-border)',
            color: 'var(--dgod-text-muted)'
          }}
        >
          AES-256-GCM Zero-Knowledge Storage Policy | ISO 27001 Ready
        </div>
      </div>

      {/* Google MFA Pairing Modal Dialog */}
      {showPairModal && pairSetupData && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col space-y-4 my-8 transition-all"
            style={{
              backgroundColor: 'var(--dgod-bg-surface)',
              border: '1px solid var(--dgod-border-strong)',
              color: 'var(--dgod-text-primary)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: 'var(--dgod-border)' }}
            >
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-sm font-bold" style={{ color: 'var(--dgod-text-primary)' }}>
                  Enable Google Authenticator (MFA)
                </h3>
              </div>
              <button
                onClick={() => setShowPairModal(false)}
                className="p-1 transition cursor-pointer"
                style={{ color: 'var(--dgod-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--dgod-text-secondary)' }}>
              Scan this QR code with <strong>Google Authenticator</strong> (or Microsoft Authenticator) on your phone, then enter your master password and the generated 6-digit code.
            </p>

            {/* QR Code Canvas */}
            <div className="flex flex-col items-center justify-center py-2 space-y-3">
              <div
                className="p-3 bg-white rounded-xl shadow-sm border"
                style={{ borderColor: 'var(--dgod-border)' }}
              >
                <QrCanvas text={pairSetupData.otpauthUrl} size={160} />
              </div>

              <div className="w-full space-y-1 text-center">
                <div className="text-[11px]" style={{ color: 'var(--dgod-text-secondary)' }}>
                  Manual secret entry code:
                </div>
                <div
                  className="flex items-center gap-1 rounded p-1.5 font-mono text-[11px]"
                  style={{
                    backgroundColor: 'var(--dgod-bg-sidebar)',
                    border: '1px solid var(--dgod-border-strong)',
                    color: 'var(--dgod-text-primary)'
                  }}
                >
                  <span className="flex-1 truncate select-all">{pairSetupData.secret}</span>
                  <button
                    type="button"
                    onClick={() => handleCopySecret(pairSetupData.secret)}
                    className="p-1 cursor-pointer"
                    style={{ color: 'var(--dgod-text-muted)' }}
                    title="Copy secret key"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handlePairSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--dgod-text-primary)' }}>
                  Workstation Master Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your master password..."
                  value={pairPassword}
                  onChange={(e) => setPairPassword(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition"
                  style={{
                    backgroundColor: 'var(--dgod-bg-sidebar)',
                    border: '1px solid var(--dgod-border-strong)',
                    color: 'var(--dgod-text-primary)'
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1 text-emerald-600 dark:text-emerald-400">
                  6-Digit Authenticator Code
                </label>
                <input
                  ref={pairTokenInputRef}
                  type="text"
                  maxLength={6}
                  placeholder="000 000"
                  value={pairToken}
                  onChange={(e) => setPairToken(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg p-2 text-center text-sm font-mono tracking-widest focus:outline-none transition"
                  style={{
                    backgroundColor: 'var(--dgod-bg-sidebar)',
                    border: '1px solid #10b981',
                    color: 'var(--dgod-text-primary)'
                  }}
                  required
                />
              </div>

              {pairError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{pairError}</span>
                </div>
              )}

              {pairSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Google MFA successfully activated! Signing in...</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPairModal(false)}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer"
                  style={{
                    backgroundColor: 'var(--dgod-bg-sidebar)',
                    border: '1px solid var(--dgod-border-strong)',
                    color: 'var(--dgod-text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPairingSubmitting || !pairPassword || pairToken.length !== 6}
                  className="flex-1 py-2 px-3 rounded-lg text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                  style={{
                    backgroundColor: '#10b981'
                  }}
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
