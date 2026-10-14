import React, { useState } from 'react';
import {
  UploadCloud,
  Search,
  X,
  FileCode,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Play,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ConnectionProfile } from '../../domain/types';

interface BatchPushModalProps {
  profiles: ConnectionProfile[];
  onClose: () => void;
}

export const BatchPushModal: React.FC<BatchPushModalProps> = ({ profiles, onClose }) => {
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [remotePath, setRemotePath] = useState('/etc/nginx/nginx.conf');
  const [fileContent, setFileContent] = useState('');
  const [mode, setMode] = useState('0644');
  const [backup, setBackup] = useState(true);
  const [useSudo, setUseSudo] = useState(true);
  const [searchHost, setSearchHost] = useState('');

  // Execution states
  const [previewResults, setPreviewResults] = useState<any[] | null>(null);
  const [pushResults, setPushResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileContent(evt.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (selectedProfileIds.length === 0 || !remotePath || !fileContent) return;
    setLoading(true);
    setPushResults(null);
    try {
      const res = await (window as any).dgodterm?.invokeFeature('batch:preview', {
        profileIds: selectedProfileIds,
        remotePath,
        content: fileContent
      });
      setPreviewResults(res || []);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (selectedProfileIds.length === 0 || !remotePath || !fileContent) return;
    if (!confirm(`Deploy this file to ${selectedProfileIds.length} target host(s)?`)) return;
    setLoading(true);
    try {
      const res = await (window as any).dgodterm?.invokeFeature('batch:push', {
        profileIds: selectedProfileIds,
        remotePath,
        content: fileContent,
        mode,
        backup,
        useSudo
      });
      setPushResults(res || []);
    } catch (err: any) {
      alert(`Push failed: ${err.message}`);
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
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Multi-Host Batch File Sync & Deploy
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                  SHA-256 Verified
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Push scripts, certificates, or configs to multiple hosts simultaneously with backup & verification
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Pane: Target Selection */}
          <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-950/40">
            <div className="p-3 border-b border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchHost}
                  onChange={(e) => setSearchHost(e.target.value)}
                  placeholder="Filter target hosts..."
                  className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-2.5 py-1 text-slate-200 text-xs"
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <button onClick={handleSelectAll} className="text-sky-400 hover:underline cursor-pointer">
                  {selectedProfileIds.length === filteredProfiles.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-slate-500">{selectedProfileIds.length} selected</span>
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

          {/* Right Pane: Config & Output */}
          <div className="w-2/3 flex flex-col bg-slate-900 overflow-y-auto p-4 space-y-3">
            {/* Form */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Remote Destination Path *</label>
                <input
                  type="text"
                  value={remotePath}
                  onChange={(e) => setRemotePath(e.target.value)}
                  placeholder="/etc/nginx/nginx.conf"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Permissions</label>
                  <input
                    type="text"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    placeholder="0644"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col justify-end gap-1 text-[11px] text-slate-300 pb-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} />
                    <span>Backup existing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={useSudo} onChange={(e) => setUseSudo(e.target.checked)} />
                    <span>Use sudo</span>
                  </label>
                </div>
              </div>
            </div>

            {/* File Upload / Content */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400 font-medium">File Content *</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 file:text-[11px]"
                />
              </div>
              <textarea
                rows={6}
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="Paste script or configuration file content here..."
                className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-slate-200 font-mono text-xs focus:border-emerald-500"
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handlePreview}
                disabled={loading || selectedProfileIds.length === 0 || !fileContent}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Diff ({selectedProfileIds.length})</span>
              </button>

              <button
                onClick={handlePush}
                disabled={loading || selectedProfileIds.length === 0 || !fileContent}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Deploy to {selectedProfileIds.length} Host(s)</span>
              </button>
            </div>

            {/* Push Execution Results */}
            {pushResults && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <h3 className="font-semibold text-slate-200 text-xs">Deployment Results</h3>
                <div className="space-y-1.5">
                  {pushResults.map((r) => {
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
                          {r.success ? `Verified (${r.durationMs}ms)` : `Error: ${r.error}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preview Diff Results */}
            {previewResults && !pushResults && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <h3 className="font-semibold text-slate-200 text-xs">Diff Inspection</h3>
                <div className="space-y-2">
                  {previewResults.map((pr) => {
                    const prof = profiles.find((p) => p.id === pr.profileId);
                    const isExp = expandedDiffs[pr.profileId];

                    return (
                      <div key={pr.profileId} className="border border-slate-800 rounded overflow-hidden">
                        <div
                          onClick={() => setExpandedDiffs({ ...expandedDiffs, [pr.profileId]: !isExp })}
                          className="p-2 bg-slate-900 flex items-center justify-between cursor-pointer hover:bg-slate-850"
                        >
                          <span className="font-semibold text-slate-200">{prof?.display_name || pr.profileId}</span>
                          <div className="flex items-center gap-2 text-[11px]">
                            {pr.identical ? (
                              <span className="text-slate-400">Identical</span>
                            ) : pr.exists ? (
                              <span className="text-amber-400">Differences detected</span>
                            ) : (
                              <span className="text-emerald-400">New file</span>
                            )}
                            {isExp ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                        </div>
                        {isExp && (
                          <pre className="p-3 font-mono text-[11px] text-slate-300 bg-slate-950 overflow-x-auto whitespace-pre-wrap">
                            {pr.diff || 'No diff'}
                          </pre>
                        )}
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
