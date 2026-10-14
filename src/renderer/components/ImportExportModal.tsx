import React, { useState, useEffect } from 'react';
import { Folder, ConnectionProfile } from '../../domain/types';
import { parseSshHostList, convertToProfile, ParsedSshHost } from '../utils/ssh-host-parser';
import {
  Download,
  Upload,
  FileCheck2,
  AlertTriangle,
  X,
  CheckCircle2,
  Copy,
  ShieldAlert,
  Lock,
  KeyRound,
  FileArchive,
  Check,
  Server,
  Folder as FolderIcon,
  Tag,
  FileText,
  Sliders,
  Sparkles,
  RefreshCw,
  Plus
} from 'lucide-react';

interface ImportExportModalProps {
  onClose: () => void;
  onRefreshProfiles: () => void;
  folders?: Folder[];
  initialTab?: 'import-hosts' | 'export' | 'disaster-recovery';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  onClose,
  onRefreshProfiles,
  folders = [],
  initialTab = 'import-hosts'
}) => {
  const [activeTab, setActiveTab] = useState<'import-hosts' | 'export' | 'disaster-recovery'>(initialTab);

  // SSH Hosts Batch Import State
  const [inputText, setInputText] = useState('');
  const [defaultUser, setDefaultUser] = useState('operator');
  const [defaultPort, setDefaultPort] = useState(22);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState('imported');
  const [parsedHosts, setParsedHosts] = useState<ParsedSshHost[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success?: boolean; count?: number; error?: string } | null>(null);

  // Export State
  const [exportedJson, setExportedJson] = useState('');
  const [copied, setCopied] = useState(false);

  // Disaster Recovery Encrypted State
  const [drMode, setDrMode] = useState<'export' | 'restore'>('export');
  const [drPassphrase, setDrPassphrase] = useState('');
  const [drConfirmPassphrase, setDrConfirmPassphrase] = useState('');
  const [drRestoreJson, setDrRestoreJson] = useState('');
  const [drStatus, setDrStatus] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse hosts dynamically when input text or options change
  useEffect(() => {
    if (!inputText.trim()) {
      setParsedHosts([]);
      return;
    }

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const results = parseSshHostList(inputText, {
      defaultUser,
      defaultPort,
      defaultFolderId: targetFolderId,
      commonTags: tags
    });
    setParsedHosts(results);
    setImportResult(null);
  }, [inputText, defaultUser, defaultPort, targetFolderId, tagsInput]);

  const handleToggleHost = (id: string) => {
    setParsedHosts((prev) =>
      prev.map((h) => (h.id === id ? { ...h, selected: !h.selected } : h))
    );
  };

  const handleToggleAll = (selectAll: boolean) => {
    setParsedHosts((prev) => prev.map((h) => ({ ...h, selected: selectAll })));
  };

  const handleBatchImportSubmit = async () => {
    const selectedHosts = parsedHosts.filter((h) => h.selected);
    if (selectedHosts.length === 0) {
      setImportResult({ success: false, error: 'No hosts selected for import.' });
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      // Convert parsed hosts to profiles
      const profilesToImport: ConnectionProfile[] = selectedHosts.map(convertToProfile);

      // Import via backend API
      const res = await (window as any).dgodterm.importProfiles(profilesToImport);

      if (res.success) {
        setImportResult({ success: true, count: res.importedCount || profilesToImport.length });
        onRefreshProfiles();
      } else {
        setImportResult({ success: false, error: res.error || 'Failed to import hosts.' });
      }
    } catch (err: any) {
      setImportResult({ success: false, error: err.message || 'Import error' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setInputText(content);
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    try {
      const json = await (window as any).dgodterm.exportProfiles();
      setExportedJson(json);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSample = (sampleType: 'list' | 'sshconfig' | 'csv') => {
    if (sampleType === 'list') {
      setInputText(
        `# Enterprise Web & Database Nodes\n` +
        `192.168.1.10 # Primary Nginx Gateway\n` +
        `root@192.168.1.20:2222 Bastion Host\n` +
        `ubuntu@10.0.0.50 App-Node-01\n` +
        `postgres@10.0.0.60:5432 Prod Database\n` +
        `ssh admin@10.0.0.70 -p 2200 -l sysadmin\n` +
        `api.company.internal`
      );
    } else if (sampleType === 'sshconfig') {
      setInputText(
        `Host prod-bastion\n` +
        `  HostName bastion.example.com\n` +
        `  User ec2-user\n` +
        `  Port 2222\n` +
        `  IdentityFile ~/.ssh/id_ed25519\n\n` +
        `Host prod-db-primary\n` +
        `  HostName 10.0.1.50\n` +
        `  User postgres\n` +
        `  Port 22\n\n` +
        `Host staging-api\n` +
        `  HostName 10.0.2.20\n` +
        `  User ubuntu`
      );
    } else if (sampleType === 'csv') {
      setInputText(
        `Name,Hostname,User,Port,Tags\n` +
        `Redis Cache,10.0.1.100,redis,6379,cache;prod\n` +
        `K8s Controller 01,10.0.1.101,root,22,kubernetes;control\n` +
        `K8s Worker 01,10.0.1.102,root,22,kubernetes;worker`
      );
    }
  };

  // Disaster Recovery Handlers
  const handleDRExport = async () => {
    setDrStatus(null);
    if (!drPassphrase || drPassphrase.length < 6) {
      setDrStatus({ success: false, error: 'Passphrase must be at least 6 characters long.' });
      return;
    }
    if (drPassphrase !== drConfirmPassphrase) {
      setDrStatus({ success: false, error: 'Passphrase confirmation does not match.' });
      return;
    }

    try {
      setIsProcessing(true);
      const encryptedBundle = await (window as any).dgodterm.exportEncryptedBackup(drPassphrase);
      setDrStatus({ success: true, message: 'Encrypted disaster recovery bundle (.dgodvault) created successfully!' });

      const blob = new Blob([encryptedBundle], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dgodterm-backup-${new Date().toISOString().slice(0, 10)}.dgodvault`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDrStatus({ success: false, error: err.message || 'Encryption failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDRRestore = async () => {
    setDrStatus(null);
    if (!drPassphrase) {
      setDrStatus({ success: false, error: 'Please enter the decryption passphrase.' });
      return;
    }
    if (!drRestoreJson.trim()) {
      setDrStatus({ success: false, error: 'Please paste or upload the .dgodvault backup JSON.' });
      return;
    }

    try {
      setIsProcessing(true);
      const res = await (window as any).dgodterm.restoreEncryptedBackup(drRestoreJson, drPassphrase);
      setDrStatus({
        success: true,
        message: `Restoration complete! Recovered ${res.restoredProfiles} profiles, ${res.restoredFolders} folders, and ${res.restoredSnippets} snippets.`
      });
      onRefreshProfiles();
    } catch (err: any) {
      setDrStatus({ success: false, error: err.message || 'Decryption failed. Check passphrase or file integrity.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedCount = parsedHosts.filter((h) => h.selected).length;
  const detectedFormat = parsedHosts[0]?.detectedFormat || 'Plaintext / Host List';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Import & Manage SSH Fleet Hosts
              </h3>
              <p className="text-xs text-slate-400">
                Batch import Linux hosts from SSH configs, IP lists, CSV, or restore backups
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('import-hosts')}
            className={`flex-1 py-3 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'import-hosts'
                ? 'border-sky-500 text-sky-300 bg-slate-900/50 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4 text-sky-400" />
            <span>Import SSH Hosts (Batch)</span>
          </button>
          <button
            onClick={() => { setActiveTab('export'); handleExport(); }}
            className={`flex-1 py-3 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'border-indigo-500 text-indigo-300 bg-slate-900/50 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Export Fleet Profiles</span>
          </button>
          <button
            onClick={() => setActiveTab('disaster-recovery')}
            className={`flex-1 py-3 font-semibold text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'disaster-recovery'
                ? 'border-amber-500 text-amber-300 bg-slate-900/50 shadow-inner'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Encrypted Disaster Recovery (.dgodvault)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* ========================================================= */}
          {/* TAB 1: IMPORT SSH HOSTS (BATCH)                           */}
          {/* ========================================================= */}
          {activeTab === 'import-hosts' && (
            <div className="space-y-4">
              {/* Instructions and Quick Samples */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-white">Paste or Upload Host List in Any Format</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Supports <strong>IP lists</strong>, <strong>user@host:port</strong>, <strong>OpenSSH ~/.ssh/config</strong>, <strong>CSV</strong>, or <strong>Ansible inventory</strong>.
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Samples:</span>
                  <button
                    onClick={() => handleLoadSample('list')}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-800 transition cursor-pointer"
                  >
                    Plaintext
                  </button>
                  <button
                    onClick={() => handleLoadSample('sshconfig')}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-800 transition cursor-pointer"
                  >
                    ~/.ssh/config
                  </button>
                  <button
                    onClick={() => handleLoadSample('csv')}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-800 transition cursor-pointer"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Textarea Input & Upload Button */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    Host Data Input
                  </label>
                  <label className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-medium">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Host File</span>
                    <input
                      type="file"
                      accept=".txt,.csv,.tsv,.conf,.config,.ini,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={6}
                  placeholder={`Paste host list, for example:\n192.168.1.50 # Web Server\nroot@192.168.1.60:2222\nubuntu@bastion.corp.net\n10.0.0.10 Database-Primary\n\nOr paste ~/.ssh/config contents directly...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed shadow-inner"
                />
              </div>

              {/* Import Options: Default User, Port, Folder, Tags */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Default Username
                  </label>
                  <input
                    type="text"
                    value={defaultUser}
                    onChange={(e) => setDefaultUser(e.target.value)}
                    placeholder="e.g. root"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Default Port
                  </label>
                  <input
                    type="number"
                    value={defaultPort}
                    onChange={(e) => setDefaultPort(parseInt(e.target.value, 10) || 22)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Assign to Folder
                  </label>
                  <select
                    value={targetFolderId || ''}
                    onChange={(e) => setTargetFolderId(e.target.value || null)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">(No Folder / Root)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Assign Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="imported, fleet"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Parsed Hosts Live Preview */}
              {parsedHosts.length > 0 && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">
                        Parsed Hosts Preview ({selectedCount} of {parsedHosts.length} selected)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-950/80 text-sky-300 border border-sky-800/60 uppercase">
                        Format: {detectedFormat}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAll(true)}
                        className="text-sky-400 hover:text-sky-300 text-[11px] cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        onClick={() => handleToggleAll(false)}
                        className="text-slate-400 hover:text-slate-300 text-[11px] cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-850">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-900/80 text-[11px] text-slate-400 font-mono sticky top-0">
                        <tr>
                          <th className="p-2.5 w-8"></th>
                          <th className="p-2.5">Display Name</th>
                          <th className="p-2.5">Hostname / IP</th>
                          <th className="p-2.5">User</th>
                          <th className="p-2.5">Port</th>
                          <th className="p-2.5">Tags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {parsedHosts.map((h) => (
                          <tr
                            key={h.id}
                            className={`hover:bg-slate-900/40 transition cursor-pointer ${
                              h.selected ? 'text-slate-200' : 'text-slate-500 opacity-60'
                            }`}
                            onClick={() => handleToggleHost(h.id)}
                          >
                            <td className="p-2.5">
                              <input
                                type="checkbox"
                                checked={h.selected}
                                onChange={() => handleToggleHost(h.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-medium text-white truncate max-w-[140px]">
                              {h.display_name}
                            </td>
                            <td className="p-2.5 font-mono text-slate-300">{h.hostname}</td>
                            <td className="p-2.5 font-mono text-slate-400">{h.username}</td>
                            <td className="p-2.5 font-mono text-slate-400">{h.port}</td>
                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(h.tags) && h.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-900 text-slate-400 border border-slate-800"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Status Message */}
              {importResult && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                    importResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {importResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Successfully imported <strong>{importResult.count}</strong> SSH hosts into your fleet!
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Import Error: {importResult.error}</span>
                    </>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-500 text-[11px]">
                  All profiles validated against <code className="text-sky-400 font-mono">profile.schema.json</code>
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBatchImportSubmit}
                    disabled={isImporting || selectedCount === 0}
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold transition cursor-pointer flex items-center gap-2 shadow-lg shadow-sky-600/30"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {isImporting
                        ? 'Importing...'
                        : `Confirm & Import ${selectedCount} Hosts`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: EXPORT PROFILES (JSON)                             */}
          {/* ========================================================= */}
          {activeTab === 'export' && (
            <div className="space-y-3">
              <p className="text-slate-400">
                Exports profile metadata versioned against <span className="font-mono text-sky-400">profile.schema.json</span>.
                Credential references and private secrets are safely omitted.
              </p>

              {exportedJson ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Export Payload JSON:</span>
                    <button
                      onClick={handleCopy}
                      className="text-sky-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
                    </button>
                  </div>
                  <pre className="max-h-80 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300">
                    {exportedJson}
                  </pre>
                </div>
              ) : (
                <button
                  onClick={handleExport}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Generate Export Payload
                </button>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: DISASTER RECOVERY (.dgodvault)                     */}
          {/* ========================================================= */}
          {activeTab === 'disaster-recovery' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-slate-300">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold text-amber-300">Military-Grade Disaster Recovery:</span> Encrypted with <span className="font-mono text-amber-300 font-semibold">AES-256-GCM</span> + PBKDF2 (100,000 rounds).
                  Includes all host profiles, folders, snippets, tunnels, and cryptographic audit chains. Keep your passphrase safe; without it, data cannot be recovered.
                </div>
              </div>

              {/* Sub-mode selector */}
              <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  onClick={() => { setDrMode('export'); setDrStatus(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    drMode === 'export' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Encrypted Backup (.dgodvault)
                </button>
                <button
                  onClick={() => { setDrMode('restore'); setDrStatus(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    drMode === 'restore' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Restore From Vault (.dgodvault)
                </button>
              </div>

              {drMode === 'export' ? (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Master Vault Passphrase (Min 6 chars)
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                        <input
                          type="password"
                          placeholder="Enter strong passphrase..."
                          value={drPassphrase}
                          onChange={(e) => setDrPassphrase(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Confirm Master Passphrase
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                        <input
                          type="password"
                          placeholder="Re-type passphrase..."
                          value={drConfirmPassphrase}
                          onChange={(e) => setDrConfirmPassphrase(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleDRExport}
                      disabled={isProcessing || !drPassphrase}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2 text-xs shadow-md cursor-pointer"
                    >
                      <FileArchive className="w-4 h-4" />
                      {isProcessing ? 'Encrypting Vault...' : 'Export & Download .dgodvault'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Vault File (.dgodvault)
                    </label>
                    <input
                      type="file"
                      accept=".dgodvault,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => setDrRestoreJson(event.target?.result as string);
                        reader.readAsText(file);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Or Paste Raw Vault JSON
                    </label>
                    <textarea
                      rows={4}
                      placeholder='{ "version": 1, "cipherText": "...", "iv": "...", "salt": "...", "tag": "..." }'
                      value={drRestoreJson}
                      onChange={(e) => setDrRestoreJson(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Master Decryption Passphrase
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                      <input
                        type="password"
                        placeholder="Enter the passphrase used when exporting..."
                        value={drPassphrase}
                        onChange={(e) => setDrPassphrase(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleDRRestore}
                      disabled={isProcessing || !drPassphrase || !drRestoreJson.trim()}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2 text-xs shadow-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isProcessing ? 'Decrypting & Restoring...' : 'Decrypt & Restore Workspace'}
                    </button>
                  </div>
                </div>
              )}

              {drStatus && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    drStatus.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {drStatus.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{drStatus.message}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{drStatus.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
