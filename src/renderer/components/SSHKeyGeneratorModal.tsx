import React, { useState } from 'react';
import { GeneratedSSHKeyPair } from '../../domain/types';
import {
  Key,
  Shield,
  Copy,
  Check,
  Download,
  X,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface SSHKeyGeneratorModalProps {
  onClose: () => void;
  onKeyGenerated?: (keyPair: GeneratedSSHKeyPair) => void;
}

export const SSHKeyGeneratorModal: React.FC<SSHKeyGeneratorModalProps> = ({
  onClose,
  onKeyGenerated
}) => {
  const [keyType, setKeyType] = useState<'ed25519' | 'rsa'>('ed25519');
  const [comment, setComment] = useState('operator@dgodterm-client');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<GeneratedSSHKeyPair | null>(null);
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedPriv, setCopiedPriv] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    try {
      const res = await (window as any).dgodterm.generateSSHKeyPair({
        type: keyType,
        bits: keyType === 'rsa' ? 4096 : undefined,
        comment: comment.trim() || undefined,
        passphrase: passphrase.trim() || undefined
      });
      setGeneratedKey(res);
      if (onKeyGenerated) {
        onKeyGenerated(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate SSH key pair');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPublic = async () => {
    if (!generatedKey) return;
    await copyTextToClipboard(generatedKey.publicKey);
    setCopiedPub(true);
    setTimeout(() => setCopiedPub(false), 2000);
  };

  const handleCopyPrivate = async () => {
    if (!generatedKey) return;
    await copyTextToClipboard(generatedKey.privateKey);
    setCopiedPriv(true);
    setTimeout(() => setCopiedPriv(false), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPublic = () => {
    if (!generatedKey) return;
    const name = generatedKey.type === 'ed25519' ? 'id_ed25519.pub' : 'id_rsa.pub';
    downloadFile(name, generatedKey.publicKey);
  };

  const handleDownloadPrivate = () => {
    if (!generatedKey) return;
    const name = generatedKey.type === 'ed25519' ? 'id_ed25519' : 'id_rsa';
    downloadFile(name, generatedKey.privateKey);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Generate Cryptographic SSH Key Pair
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                  FIPS / ISO 27001
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Create Ed25519 or RSA-4096 keys locally with zero telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-950/60 border border-red-800/80 text-red-200 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Key Type Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setKeyType('ed25519')}
              className={`p-3 rounded-lg border text-left transition flex flex-col gap-1 cursor-pointer ${
                keyType === 'ed25519'
                  ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-sm shadow-emerald-950'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Ed25519 (Recommended)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 font-mono">
                  256-bit
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Modern high-speed Edwards-curve signature. Compact, resistant to side-channel attacks.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setKeyType('rsa')}
              className={`p-3 rounded-lg border text-left transition flex flex-col gap-1 cursor-pointer ${
                keyType === 'rsa'
                  ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-sm shadow-emerald-950'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">RSA-4096</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300 font-mono">
                  4096-bit
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Legacy enterprise compatibility with modern 4096-bit modulus length.
              </span>
            </button>
          </div>

          {/* Comment & Passphrase */}
          <div className="space-y-3 bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
            <div>
              <label className="text-slate-300 font-medium block mb-1">Key Comment / Identifier</label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="operator@company or workstation-id"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-emerald-500 font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Passphrase Protection (Optional)
                </label>
                <span className="text-[10px] text-slate-500">Leave blank for passwordless key</span>
              </div>
              <div className="relative">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Optional private key encryption passphrase..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:border-emerald-500 text-xs pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold transition cursor-pointer shadow-md disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Generating Cryptographic Key...' : 'Generate New Key Pair'}</span>
            </button>
          </div>

          {/* Results Box */}
          {generatedKey && (
            <div className="space-y-3 bg-emerald-950/20 border border-emerald-800/60 rounded-lg p-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Key Pair Successfully Generated
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                  {generatedKey.fingerprint}
                </span>
              </div>

              {/* Public Key Display */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Public Key (OpenSSH Format)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPublic}
                      className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      {copiedPub ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPub ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPublic}
                      className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download .pub</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={generatedKey.publicKey}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-mono text-[10px] select-all resize-none"
                />
              </div>

              {/* Private Key Display & Download */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    Private Key (Save Securely)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPrivate}
                      className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      {copiedPriv ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPriv ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPrivate}
                      className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download Private Key</span>
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-amber-300/80 mb-1">
                  Keep this private key confidential. Add the public key above to <code>~/.ssh/authorized_keys</code> on your remote target servers.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
