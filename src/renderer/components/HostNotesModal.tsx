import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  Save,
  Check,
  Copy,
  Terminal,
  Eye,
  Edit3,
  Server,
  FolderIcon,
  Tag,
  AlertTriangle,
  Lightbulb,
  BookOpen
} from 'lucide-react';
import { ConnectionProfile, Folder } from '../../domain/types';
import { DistroIcon } from './DistroIcon';

interface HostNotesModalProps {
  profile: ConnectionProfile;
  folders: Folder[];
  onSave: (updatedProfile: ConnectionProfile) => Promise<void> | void;
  onClose: () => void;
  onConnectTerminal?: () => void;
}

export const HostNotesModal: React.FC<HostNotesModalProps> = ({
  profile,
  folders,
  onSave,
  onClose,
  onConnectTerminal
}) => {
  const [notes, setNotes] = useState(profile.notes || '');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const folder = folders.find((f) => f.id === profile.folder_id);
  const hasChanges = (profile.notes || '') !== notes;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notes, profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated: ConnectionProfile = {
        ...profile,
        notes: notes.trim() ? notes : null,
        updated_at: new Date().toISOString()
      };
      await onSave(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2200);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!notes) return;
    navigator.clipboard.writeText(notes);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const insertTemplate = (templateText: string) => {
    setNotes((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${templateText}` : templateText;
    });
    setActiveTab('edit');
  };

  // Basic lightweight markdown rendering for insights
  const renderSimpleMarkdown = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="py-12 text-center text-slate-500 italic">
          No insights or comments recorded for this host yet. Click "Edit Notes" to write operational notes or insert a template.
        </div>
      );
    }

    const lines = text.split('\n');
    return (
      <div className="space-y-2 text-slate-200 text-xs leading-relaxed font-sans select-text">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-sm font-bold text-amber-400 mt-4 mb-1 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-base font-bold text-white mt-4 mb-1 border-b border-slate-700 pb-1">
                {line.replace('## ', '')}
              </h3>
            );
          }
          if (line.startsWith('# ')) {
            return (
              <h2 key={idx} className="text-lg font-black text-amber-300 mt-4 mb-1 border-b border-slate-700 pb-1.5">
                {line.replace('# ', '')}
              </h2>
            );
          }
          if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
            const isChecked = line.startsWith('- [x] ');
            const label = line.replace(/- \[[ x]\] /, '');
            return (
              <div key={idx} className="flex items-center gap-2 pl-2 text-slate-300">
                <input type="checkbox" readOnly checked={isChecked} className="rounded bg-slate-800 border-slate-700 text-amber-500" />
                <span className={isChecked ? 'line-through text-slate-500' : ''}>{label}</span>
              </div>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={idx} className="ml-4 list-disc text-slate-300 pl-1">
                {formatInline(line.slice(2))}
              </li>
            );
          }
          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} className="border-l-2 border-amber-500/80 bg-amber-500/10 px-3 py-1.5 rounded-r text-amber-200/90 italic">
                {formatInline(line.slice(2))}
              </blockquote>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-2" />;
          }
          return <p key={idx} className="text-slate-300">{formatInline(line)}</p>;
        })}
      </div>
    );
  };

  const formatInline = (str: string) => {
    // Basic bold **text** and inline `code`
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-slate-800 text-amber-300 px-1 py-0.5 rounded font-mono text-[11px] border border-slate-700">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              {profile.os_flavor ? (
                <DistroIcon flavor={profile.os_flavor} className="w-5 h-5" size={22} />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">{profile.display_name}</h3>
                {profile.os_name && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {profile.os_name}
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Host Insights
                </span>
                {hasChanges && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                    Unsaved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                <span>{profile.username}@{profile.hostname}:{profile.port}</span>
                {folder && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    • <FolderIcon className="w-3 h-3 text-amber-400/80 inline" /> {folder.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onConnectTerminal && (
              <button
                onClick={() => {
                  if (hasChanges) handleSave();
                  onConnectTerminal();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                title="Connect SSH"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Connect</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Subheader */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-slate-800 text-amber-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit Notes</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-slate-800 text-amber-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
          </div>

          {/* Quick Insert Templates */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Insert:
            </span>
            <button
              onClick={() => insertTemplate('### Host Purpose & Role\n- Primary Service: \n- Environment: Production / Staging\n- Docker/Service Port: ')}
              className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-800 hover:text-amber-300 text-slate-400 border border-slate-700/60 text-[11px] cursor-pointer transition"
              title="Insert Purpose Template"
            >
              + Role & Purpose
            </button>
            <button
              onClick={() => insertTemplate('### Access & Sudo Quirks\n- Sudo Rule: \n- Shell: /bin/bash\n- Key Pair: ~/.ssh/id_ed25519')}
              className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-800 hover:text-amber-300 text-slate-400 border border-slate-700/60 text-[11px] cursor-pointer transition"
              title="Insert Access Template"
            >
              + Access Rules
            </button>
            <button
              onClick={() => insertTemplate('### Operational Caution\n- Important: Do not reboot without notifying the team.\n- Backup path: /var/backups/')}
              className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-800 hover:text-amber-300 text-slate-400 border border-slate-700/60 text-[11px] cursor-pointer transition"
              title="Insert Caution Template"
            >
              + Caution
            </button>
          </div>
        </div>

        {/* Editor / Preview Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950/40">
          {activeTab === 'edit' ? (
            <div className="flex flex-col h-full space-y-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write insightful comments, architectural details, internal IP mappings, recovery instructions, service ports, or quirks about this host for quick recollection..."
                rows={14}
                className="w-full h-72 p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 resize-y leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span className="flex items-center gap-1">
                  <Lightbulb className="w-3 h-3 text-amber-500/80" />
                  Supports Markdown headings (`###`), bullet points (`-`), bold (`**bold**`), and inline code (`` `code` ``).
                </span>
                <span>
                  {notes.length} characters • {notes.trim() ? notes.trim().split(/\s+/).length : 0} words
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 min-h-[18rem] max-h-96 overflow-y-auto">
              {renderSimpleMarkdown(notes)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!notes}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Notes</span>
                </>
              )}
            </button>
            {notes && (
              <button
                onClick={() => setNotes('')}
                className="px-2 py-1.5 text-xs text-slate-500 hover:text-red-400 transition cursor-pointer"
                title="Clear notes"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition cursor-pointer ${
                isSaved
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved Insights!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Insights</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
