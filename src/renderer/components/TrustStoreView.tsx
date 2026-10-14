import React, { useState, useEffect } from 'react';
import { HostTrustRecord } from '../../domain/types';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  KeyRound,
  Trash2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  ExternalLink,
  X
} from 'lucide-react';
import { CustomSelect, CustomSelectOption } from './CustomSelect';
import { SSHKeyGeneratorModal } from './SSHKeyGeneratorModal';

const KEY_TYPE_OPTIONS: CustomSelectOption<string>[] = [
  { value: 'ssh-ed25519', label: 'ssh-ed25519 (Recommended)', description: 'Ed25519 elliptic curve signature (Modern & secure)', badge: 'Recommended', badgeVariant: 'emerald', dotColor: 'emerald' },
  { value: 'rsa-sha2-512', label: 'rsa-sha2-512', description: 'RSA with SHA-512 hashing', badge: 'Standard', badgeVariant: 'sky', dotColor: 'sky' },
  { value: 'ecdsa-sha2-nistp256', label: 'ecdsa-sha2-nistp256', description: 'NIST P-256 elliptic curve signature', badge: 'Legacy', badgeVariant: 'slate', dotColor: 'slate' },
];


export const TrustStoreView: React.FC = () => {
  const [records, setRecords] = useState<HostTrustRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<HostTrustRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showKeyGenModal, setShowKeyGenModal] = useState(false);

  // New key manual enrollment form
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState(22);
  const [newKeyType, setNewKeyType] = useState('ssh-ed25519');
  const [newFingerprint, setNewFingerprint] = useState('');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await (window as any).dgodterm.getHostTrustRecords();
      setRecords(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevoke = async (recordId: string) => {
    const reason = prompt('Please enter revocation reason (e.g. Host decommissioned or key compromised):');
    if (!reason) return;

    try {
      await (window as any).dgodterm.revokeHostKey(recordId, reason);
      loadRecords();
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualEnroll = async () => {
    if (!newHost.trim() || !newFingerprint.trim()) return;

    try {
      await (window as any).dgodterm.acceptHostKey({
        hostname: newHost.trim(),
        port: newPort,
        keyType: newKeyType,
        fingerprint: newFingerprint.trim(),
        rawPublicKey: '',
        verifiedBy: 'operator-manual',
        reason: newReason || 'Manually enrolled by operator'
      });
      setShowAddModal(false);
      setNewHost('');
      setNewFingerprint('');
      loadRecords();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = records.filter((r) => {
    const s = search.toLowerCase();
    return (
      r.hostname_pattern.toLowerCase().includes(s) ||
      r.key_or_ca_fingerprint.toLowerCase().includes(s) ||
      r.key_type.toLowerCase().includes(s) ||
      r.verified_by.toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#090d16] text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Host Identity & Certificate Authority Trust Store
          </h2>
          <p className="text-xs text-slate-400">
            Enforces strict known-host verification. Silent trust-on-first-use is prohibited.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyGenModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Generate SSH Key Pair</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Host Key / CA</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 w-80">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by hostname, fingerprint, algorithm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-slate-200 outline-none w-full"
          />
        </div>

        <div className="text-xs text-slate-400">
          Total Trust Records: <span className="text-white font-semibold">{filtered.length}</span>
        </div>
      </div>

      {/* Trust Records Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                <th className="py-2.5 px-4 font-sans font-semibold">Endpoint Pattern</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Port</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Algorithm</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Fingerprint (SHA-256)</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Source</th>
                <th className="py-2.5 px-3 font-sans font-semibold">Status</th>
                <th className="py-2.5 px-4 font-sans font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedRecord(r)}
                  className="border-b border-slate-800/40 hover:bg-slate-800/40 cursor-pointer transition"
                >
                  <td className="py-2.5 px-4 text-slate-200 font-semibold">{r.hostname_pattern}</td>
                  <td className="py-2.5 px-3 text-slate-400">{r.port}</td>
                  <td className="py-2.5 px-3 text-indigo-400">{r.key_type}</td>
                  <td className="py-2.5 px-3 text-emerald-400 select-all truncate max-w-[200px]">
                    {r.key_or_ca_fingerprint}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 capitalize">{r.source.replace('_', ' ')}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                        r.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {r.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevoke(r.id);
                        }}
                        className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-[11px] font-sans font-medium"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Enroll Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                Enroll Host Identity / CA
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Hostname Pattern *</label>
                <input
                  type="text"
                  placeholder="e.g. *.prod.internal or 192.168.1.10"
                  value={newHost}
                  onChange={(e) => setNewHost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Port</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Key Type</label>
                  <CustomSelect
                    value={newKeyType}
                    onChange={(val) => setNewKeyType(String(val))}
                    options={KEY_TYPE_OPTIONS}
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">SHA-256 Fingerprint *</label>
                <input
                  type="text"
                  placeholder="SHA256:..."
                  value={newFingerprint}
                  onChange={(e) => setNewFingerprint(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Verification Reference / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Terraform provisioned baseline"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleManualEnroll}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Enroll Trust Record
              </button>
            </div>
          </div>
        </div>
      )}
      {showKeyGenModal && (
        <SSHKeyGeneratorModal onClose={() => setShowKeyGenModal(false)} />
      )}
    </div>
  );
};
