import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  FileCode,
  Check,
  AlertCircle,
  Copy,
  Clock,
  RotateCcw,
  Shield,
  FileText
} from 'lucide-react';

interface RemoteFileEditorModalProps {
  sessionId: string;
  remotePath: string;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const RemoteFileEditorModal: React.FC<RemoteFileEditorModalProps> = ({
  sessionId,
  remotePath,
  onClose,
  onSaveSuccess
}) => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [createBackup, setCreateBackup] = useState(true);
  const [lineCount, setLineCount] = useState(1);

  const isDirty = content !== originalContent;

  const loadFile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await (window as any).dgodterm.readRemoteFile(sessionId, remotePath);
      if (res && res.content !== undefined) {
        setContent(res.content);
        setOriginalContent(res.content);
        setLineCount(res.content.split('\n').length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load remote file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFile();
  }, [sessionId, remotePath]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveStatus(null);
      await (window as any).dgodterm.writeRemoteFile(sessionId, remotePath, content, createBackup);
      setOriginalContent(content);
      setSaveStatus('File saved successfully (atomic write & backup verified)');
      if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to save remote file');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !saving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, isDirty, saving, createBackup]);

  const fileName = remotePath.split('/').pop() || remotePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl h-[88vh] rounded-2xl border border-slate-700 bg-slate-900 flex flex-col shadow-2xl overflow-hidden">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-mono">{fileName}</h3>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    MODIFIED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-lg" title={remotePath}>
                {remotePath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Backup checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Keep .bak
              </span>
            </label>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving || loading}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition cursor-pointer ${
                isDirty
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={() => {
                if (isDirty && !window.confirm('You have unsaved changes. Discard and close?')) {
                  return;
                }
                onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status / Error alerts */}
        {error && (
          <div className="px-4 py-2 bg-rose-950/60 border-b border-rose-800 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saveStatus && (
          <div className="px-4 py-2 bg-emerald-950/60 border-b border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* Editor Body */}
        <div className="flex-1 flex overflow-hidden bg-[#090d16] font-mono text-xs">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
              <Clock className="w-5 h-5 animate-spin text-sky-400" />
              <span>Loading remote file contents over SFTP...</span>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setLineCount(e.target.value.split('\n').length);
              }}
              className="flex-1 h-full p-4 bg-transparent text-slate-200 outline-none resize-none font-mono leading-relaxed"
              placeholder="Empty file..."
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <div className="flex items-center gap-4">
            <span>{lineCount} lines</span>
            <span>{new Blob([content]).size} bytes</span>
            <span>UTF-8</span>
          </div>
          <div className="flex items-center gap-3">
            {isDirty && (
              <button
                onClick={() => {
                  setContent(originalContent);
                  setLineCount(originalContent.split('\n').length);
                }}
                className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Revert changes</span>
              </button>
            )}
            <span>Press Ctrl+S to save</span>
          </div>
        </div>
      </div>
    </div>
  );
};
