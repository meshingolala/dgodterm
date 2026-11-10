import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X, KeyRound, BookmarkCheck } from 'lucide-react';
import { ConnectionProfile } from '../../domain/types';

interface PasswordPromptModalProps {
  profile: ConnectionProfile;
  promptText?: string;
  onSubmit: (password: string, savePassword?: boolean) => void;
  onCancel: () => void;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  profile,
  promptText,
  onSubmit,
  onCancel
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(
    profile.auth_reference?.kind === 'vault_reference'
  );
  const [isSaving, setIsSaving] = useState(false);

  const canPersistToProfile = Boolean(profile?.id && !profile.id.startsWith('local-'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isSaving) return;

    if (savePassword && canPersistToProfile) {
      setIsSaving(true);
      try {
        const dgodterm = (window as any).dgodterm;
        const existingVaultId =
          profile.auth_reference?.kind === 'vault_reference' && profile.auth_reference.reference_id
            ? profile.auth_reference.reference_id
            : `vault-${profile.id}`;
        const vaultTitle = `${profile.display_name || profile.hostname} (${profile.username}@${profile.hostname})`;

        if (dgodterm?.saveVaultCredential) {
          const savedCred = await dgodterm.saveVaultCredential({
            id: existingVaultId,
            title: vaultTitle,
            username: profile.username,
            password,
            notes: `Saved for instance ${profile.display_name || profile.hostname} (${profile.username}@${profile.hostname}:${profile.port})`
          });

          const updatedProfile: ConnectionProfile = {
            ...profile,
            auth_reference: {
              kind: 'vault_reference',
              reference_id: savedCred?.id || existingVaultId,
              account_or_key_label: savedCred?.title || vaultTitle,
              key_path: null,
              last_used_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          };

          if (dgodterm?.saveProfile) {
            await dgodterm.saveProfile(updatedProfile);
          }

          window.dispatchEvent(
            new CustomEvent('dgodterm:profile-saved', { detail: updatedProfile })
          );
        }
      } catch (err) {
        console.error('Failed to save password to vault for instance:', err);
      } finally {
        setIsSaving(false);
      }
    }

    onSubmit(password, savePassword);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[4px] p-4 animate-in fade-in duration-150"
      style={{
        fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif"
      }}
    >
      <div className="w-full max-w-[440px] rounded-[8px] border border-white/[0.12] bg-[#2b2b2b] shadow-[0_24px_64px_rgba(0,0,0,0.75)] overflow-hidden text-white">
        <div className="p-6 pb-5">
          <div className="flex items-start justify-between pb-3.5 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[6px] bg-[#0078d4]/20 border border-[#0078d4]/30 flex items-center justify-center text-[#60cdff] shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-white leading-tight">
                  Authentication Required
                </h3>
                <p className="text-xs text-white/60 mt-0.5 font-mono">
                  {profile.username}@{profile.hostname}:{profile.port}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-[4px] text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form id="ssh-password-prompt-form" onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
            <div>
              <label className="text-white/85 block mb-1.5 font-medium text-[12.5px]">
                {promptText || `Enter password for user '${profile.username}':`}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  autoFocus
                  className="w-full bg-[#1e1e1e] border border-white/15 border-b-2 border-b-[#0078d4] rounded-[4px] px-3 py-2 text-white pr-10 focus:outline-none focus:bg-[#181818] font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-white/50 hover:text-white cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {canPersistToProfile && (
              <label
                onClick={() => setSavePassword(!savePassword)}
                className={`flex items-center gap-3 p-2.5 rounded-[6px] border cursor-pointer transition-colors select-none ${
                  savePassword
                    ? 'bg-[#0078d4]/15 border-[#0078d4]/50 text-white'
                    : 'bg-[#202020] border-white/[0.08] text-white/80 hover:border-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={savePassword}
                  onChange={(e) => setSavePassword(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded-[3px] accent-[#0078d4] cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[12.5px] flex items-center gap-1.5">
                    <span>Save password for this instance</span>
                    {savePassword && <BookmarkCheck className="w-3.5 h-3.5 text-[#60cdff]" />}
                  </div>
                  <div className="text-[11px] text-white/55 truncate">
                    Remember in Encrypted Vault for {profile.display_name || profile.hostname}
                  </div>
                </div>
              </label>
            )}

            <div className="bg-[#202020] p-2.5 rounded-[6px] border border-white/[0.07] flex items-start gap-2 text-[11px] text-white/65">
              <ShieldCheck
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  savePassword ? 'text-[#60cdff]' : 'text-emerald-400'
                }`}
              />
              {savePassword ? (
                <span>
                  <strong className="text-white/90">Encrypted Vault Storage:</strong> Your password will be encrypted with AES-256 and linked to{' '}
                  <span className="text-white/90 font-medium">{profile.display_name || profile.hostname}</span> so you won&apos;t need to re-enter it next time.
                </span>
              ) : (
                <span>
                  <strong className="text-white/90">Zero-Persistence Mode:</strong> Password is held in volatile process memory for this session only and is not saved to disk.
                </span>
              )}
            </div>
          </form>
        </div>

        <div className="bg-[#202020] border-t border-white/[0.08] px-6 py-3.5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-w-[96px] px-4 py-1.5 rounded-[4px] bg-[#333333] hover:bg-[#3d3d3d] active:bg-[#292929] border border-white/[0.08] text-white text-[13px] font-normal transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="ssh-password-prompt-form"
            disabled={!password || isSaving}
            className="px-4 py-1.5 rounded-[4px] bg-[#0078d4] hover:bg-[#1084df] active:bg-[#006cbe] disabled:opacity-50 text-white text-[13px] font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving & Connecting...' : 'Authenticate & Connect'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
