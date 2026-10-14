import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Search,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { ConnectionProfile } from '../../domain/types';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface LocalKey {
  path: string;
  filename: string;
  type: string;
  comment: string;
  fingerprint: string;
  publicKey: string;
}

interface KeyDeployModalProps {
  profiles: ConnectionProfile[];
  onClose: () => void;
}

export const KeyDeployModal: React.FC<KeyDeployModalProps> = ({ profiles, onClose }) => {
  const [localKeys, setLocalKeys] = useState<LocalKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [customKeyText, setCustomKeyText] = useState('');
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [searchHost, setSearchHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadLocalKeys();
  }, []);

  const loadLocalKeys = async () => {
    try {
      const keys = await (window as any).dgodterm?.invokeFeature('keys:list-local');
      setLocalKeys(keys || []);
      if (keys?.length > 0) {
        setSelectedKey(keys[0].publicKey);
      }
    } catch {}
  };

  const activePublicKey = customKeyText.trim() || selectedKey;

  const filteredProfiles = profiles.filter((p) =>
    p.display_name.toLowerCase().includes(searchHost.toLowerCase()) ||
    p.hostname.toLowerCase().includes(searchHost.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedProfileIds.length === filteredProfiles.length) {
      setSelectedProfileIds([]);
    } else {
      setSelectedProfileIds(filteredProfiles.map((p) => p.id));
    }
  };

  const handleAction = async (action: 'deploy' | 'verify' | 'revoke') => {
    if (!activePublicKey || selectedProfileIds.length === 0) return;
    if (action === 'revoke' && !confirm(`Revoke this public key from ${selectedProfileIds.length} host(s)?`)) return;

    setLoading(true);
    try {
      const channel = action === 'deploy' ? 'keys:deploy' : action === 'verify' ? 'keys:verify' : 'keys:revoke';
      const res = await (window as any).dgodterm?.invokeFeature(channel, {
        profileIds: selectedProfileIds,
        publicKey: activePublicKey
      });
      setResults(res || []);
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                SSH Public Key Deployer & Auditor
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                  authorized_keys
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Install local SSH public keys to remote authorized_keys, verify presence, or revoke with one click
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Target Host List */}
          <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-950/40">
            <div className="p-3 border-b border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchHost}
                  onChange={(e) => setSearchHost(e.target.value)}
                  placeholder="Search servers..."
                  className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-2.5 py-1 text-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <button onClick={handleSelectAll} className="text-sky-400 hover:underline cursor-pointer">
                  {selectedProfileIds.length === filteredProfiles.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-slate-500">{selectedProfileIds.length} target(s)</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProfiles.map((p) => {
                const isChecked = selectedProfileIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                      isChecked ? 'bg-emerald-950/30 border border-emerald-800/60' : 'hover:bg-slate-900'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProfileIds([...selectedProfileIds, p.id]);
                        else setSelectedProfileIds(selectedProfileIds.filter((id) => id !== p.id));
                      }}
                      className="rounded border-slate-700 text-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate">{p.display_name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{p.hostname}:{p.port}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Key Select & Action */}
          <div className="w-2/3 flex flex-col bg-slate-900 overflow-y-auto p-4 space-y-4">
            {/* Key Selector */}
            <div className="space-y-2">
              <label className="text-slate-300 font-medium block">Select Local Public Key (~/.ssh/*.pub)</label>
              {localKeys.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedKey}
                    onChange={(e) => {
                      setSelectedKey(e.target.value);
                      setCustomKeyText('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 font-mono text-xs focus:border-emerald-500"
                  >
                    {localKeys.map((k) => (
                      <option key={k.path} value={k.publicKey}>
                        {k.filename} ({k.type}) - {k.fingerprint}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-slate-500 text-xs italic">No .pub keys found in ~/.ssh</div>
              )}
            </div>

            {/* Custom Key Paste */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium">Or Paste Custom Public Key</label>
                {activePublicKey && (
                  <button
                    onClick={async () => {
                      await copyTextToClipboard(activePublicKey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={customKeyText}
                onChange={(e) => setCustomKeyText(e.target.value)}
                placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... operator@dgodterm"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 font-mono text-xs focus:border-emerald-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleAction('verify')}
                disabled={loading || selectedProfileIds.length === 0 || !activePublicKey}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Verify Presence</span>
              </button>

              <button
                onClick={() => handleAction('revoke')}
                disabled={loading || selectedProfileIds.length === 0 || !activePublicKey}
                className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800 disabled:opacity-50 text-rose-300 font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revoke Key</span>
              </button>

              <button
                onClick={() => handleAction('deploy')}
                disabled={loading || selectedProfileIds.length === 0 || !activePublicKey}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Deploy to {selectedProfileIds.length} Host(s)</span>
              </button>
            </div>

            {/* Results Table */}
            {results && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <h3 className="font-semibold text-slate-200 text-xs">Operation Results</h3>
                <div className="space-y-1.5">
                  {results.map((r) => {
                    const prof = profiles.find((p) => p.id === r.profileId);
                    return (
                      <div
                        key={r.profileId}
                        className={`p-2 rounded border flex items-center justify-between text-xs ${
                          r.success ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300' : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {r.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                          <span className="font-semibold">{prof?.display_name || r.profileId}</span>
                        </div>
                        <div className="text-[11px] font-mono">
                          {r.alreadyPresent
                            ? 'Already present in authorized_keys'
                            : r.present !== undefined
                            ? r.present
                              ? 'Key is installed'
                              : 'Key is NOT present'
                            : r.removed
                            ? 'Successfully revoked'
                            : r.success
                            ? 'Successfully installed (chmod 600)'
                            : `Error: ${r.error}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
