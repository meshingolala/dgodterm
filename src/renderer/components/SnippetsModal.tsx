import React, { useState, useEffect } from 'react';
import { Snippet, ConnectionProfile } from '../../domain/types';
import {
  Code,
  Search,
  Plus,
  Trash2,
  Copy,
  Check,
  Terminal,
  X,
  Tag,
  Sliders,
  Sparkles,
  Edit3,
  AlertCircle,
  Server
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard-utils';

export interface SnippetsModalProps {
  onClose: () => void;
  onExecuteSnippet?: (command: string, targetSessionId?: string) => void;
  availableSessions?: Array<{
    id: string;
    sessionId: string;
    title: string;
  }>;
  activeSessionId?: string;
  profiles?: ConnectionProfile[];
  onConnectAndExecute?: (profile: ConnectionProfile, command: string) => void;
}

const CATEGORIES: Array<Snippet['category'] | 'All'> = [
  'All',
  'System',
  'Docker',
  'Network',
  'Services',
  'Logs',
  'Security',
  'Custom'
];

export const SnippetsModal: React.FC<SnippetsModalProps> = ({
  onClose,
  onExecuteSnippet,
  availableSessions,
  activeSessionId,
  profiles,
  onConnectAndExecute
}) => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Snippet['category'] | 'All'>('All');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Target session and host profile selection
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    if (activeSessionId && availableSessions?.some((s) => s.sessionId === activeSessionId)) {
      return activeSessionId;
    }
    return availableSessions?.[0]?.sessionId || '';
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    return profiles?.[0]?.id || '';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active / Selected snippet for placeholder interpolation
  const [activeSnippet, setActiveSnippet] = useState<Snippet | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // Editing / Creating new snippet
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCommand, setEditCommand] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<Snippet['category']>('Custom');
  const [editTags, setEditTags] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    loadSnippets();
  }, []);

  const loadSnippets = async () => {
    try {
      const res = await (window as any).dgodterm.getSnippets();
      setSnippets(res || []);
    } catch (e) {
      console.error('Failed to load snippets:', e);
    }
  };

  const extractPlaceholders = (cmd: string): string[] => {
    const matches = cmd.match(/\{\{([^}]+)\}\}/g) || [];
    return Array.from(new Set(matches.map((m) => m.slice(2, -2).trim())));
  };

  const handleSelectSnippet = (snippet: Snippet) => {
    setActiveSnippet(snippet);
    const placeholders = extractPlaceholders(snippet.command);
    const initialParams: Record<string, string> = {};
    placeholders.forEach((p) => {
      initialParams[p] = paramValues[p] || '';
    });
    setParamValues(initialParams);
  };

  const getResolvedCommand = (): string => {
    if (!activeSnippet) return '';
    let cmd = activeSnippet.command;
    for (const [key, val] of Object.entries(paramValues)) {
      cmd = cmd.replaceAll(`{{${key}}}`, val || `{{${key}}}`);
    }
    return cmd;
  };

  const handleExecute = () => {
    setErrorMessage(null);
    const resolved = getResolvedCommand();
    if (!resolved) return;

    if (availableSessions !== undefined) {
      if (availableSessions.length > 0) {
        const targetSid = selectedSessionId || availableSessions[0].sessionId;
        if (onExecuteSnippet) {
          onExecuteSnippet(resolved, targetSid);
          onClose();
        }
      } else if (onConnectAndExecute && profiles && profiles.length > 0) {
        const targetProf = profiles.find((p) => p.id === selectedProfileId) || profiles[0];
        if (targetProf) {
          onConnectAndExecute(targetProf, resolved);
          onClose();
        } else {
          setErrorMessage('Please select a host profile to connect and execute this snippet.');
        }
      } else {
        setErrorMessage('No active terminal session. Please open an SSH terminal tab first to run snippets.');
      }
    } else {
      if (onExecuteSnippet) {
        onExecuteSnippet(resolved);
        onClose();
      }
    }
  };

  const handleCopy = async (snippet: Snippet, cmdToCopy?: string) => {
    const text = cmdToCopy || snippet.command;
    await copyTextToClipboard(text);
    setCopiedId(snippet.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editCommand.trim()) return;

    try {
      await (window as any).dgodterm.saveSnippet({
        id: editId || undefined,
        title: editTitle.trim(),
        command: editCommand.trim(),
        description: editDescription.trim(),
        category: editCategory,
        tags: editTags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      });
      setIsEditing(false);
      setEditId(null);
      setEditTitle('');
      setEditCommand('');
      setEditDescription('');
      setEditTags('');
      await loadSnippets();
    } catch (err) {
      console.error('Failed to save snippet:', err);
    }
  };

  const handleDeleteSnippet = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom snippet?')) return;
    try {
      await (window as any).dgodterm.deleteSnippet(id);
      if (activeSnippet?.id === id) {
        setActiveSnippet(null);
      }
      await loadSnippets();
    } catch (err) {
      console.error('Failed to delete snippet:', err);
    }
  };

  const filteredSnippets = snippets.filter((s) => {
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch =
      !search.trim() ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.command.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase()) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/80 text-sky-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Snippets & Quick Commands Palette
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                  {snippets.length} Available
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Parametric sysadmin commands with multi-line safety verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditId(null);
                setEditTitle('');
                setEditCommand('');
                setEditDescription('');
                setEditCategory('Custom');
                setEditTags('');
                setIsEditing(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-950 font-semibold text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Snippet</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isEditing ? (
          /* Editor Form */
          <form onSubmit={handleSaveSnippet} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              {editId ? 'Edit Snippet' : 'Create Custom Snippet'}
            </h3>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Snippet Title *</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Restart Postgres & Inspect Logs"
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:border-sky-500 text-xs"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Command (use <code>{'{{variable}}'}</code> for parameters) *
              </label>
              <textarea
                required
                rows={4}
                value={editCommand}
                onChange={(e) => setEditCommand(e.target.value)}
                placeholder="systemctl restart {{service_name}} && journalctl -u {{service_name}} -n 50 -f"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-slate-200 focus:border-sky-500 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 focus:border-sky-500 text-xs"
                >
                  <option value="System">System</option>
                  <option value="Docker">Docker</option>
                  <option value="Network">Network</option>
                  <option value="Services">Services</option>
                  <option value="Logs">Logs</option>
                  <option value="Security">Security</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="linux, systemd, web"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 focus:border-sky-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Description</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional explanation of what this command accomplishes"
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:border-sky-500 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-950 font-semibold transition cursor-pointer shadow-md"
              >
                Save Snippet
              </button>
            </div>
          </form>
        ) : (
          /* Split View: List on left, preview & parameter fill on right */
          <div className="flex flex-1 overflow-hidden">
            {/* Left pane: search, categories, and snippet cards */}
            <div className="w-1/2 border-r border-slate-800 flex flex-col bg-slate-950/40">
              {/* Search & Categories Bar */}
              <div className="p-3 border-b border-slate-800 space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search snippets, commands, tags..."
                    className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-slate-200 text-xs focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 rounded-full shrink-0 transition cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-sky-600 text-slate-950 font-semibold'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Snippet List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredSnippets.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No matching snippets found.
                  </div>
                ) : (
                  filteredSnippets.map((s) => {
                    const isSelected = activeSnippet?.id === s.id;
                    const placeholders = extractPlaceholders(s.command);

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSnippet(s)}
                        className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-sky-950/40 border-sky-500/80 shadow-md'
                            : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs truncate">
                            <span>{s.title}</span>
                            {placeholders.length > 0 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800 text-amber-300 font-mono">
                                {placeholders.length} params
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {s.category}
                          </span>
                        </div>

                        <div className="bg-slate-950/90 rounded px-2 py-1 text-[11px] font-mono text-sky-300 truncate border border-slate-900">
                          {s.command}
                        </div>

                        {s.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{s.description}</p>
                        )}

                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <div className="flex items-center gap-1">
                            {Array.isArray(s.tags) && s.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-slate-500">
                                #{t}
                              </span>
                            ))}
                          </div>
                          {!s.is_builtin && (
                            <button
                              onClick={(e) => handleDeleteSnippet(s.id, e)}
                              className="text-red-400 hover:text-red-300 p-0.5"
                              title="Delete custom snippet"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right pane: Preview & Parameters */}
            <div className="w-1/2 p-5 flex flex-col bg-slate-900 overflow-y-auto">
              {activeSnippet ? (
                <div className="space-y-4 flex-1 flex flex-col text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        {activeSnippet.title}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                          {activeSnippet.category}
                        </span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeSnippet, getResolvedCommand())}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {copiedId === activeSnippet.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === activeSnippet.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    {activeSnippet.description && (
                      <p className="text-slate-400 text-[11px]">{activeSnippet.description}</p>
                    )}
                  </div>

                  {/* Placeholders Input */}
                  {extractPlaceholders(activeSnippet.command).length > 0 && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-300 text-[11px]">
                        <Sliders className="w-3.5 h-3.5" />
                        Configure Parameters
                      </div>
                      <div className="space-y-2">
                        {extractPlaceholders(activeSnippet.command).map((param) => (
                          <div key={param}>
                            <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                              {param}
                            </label>
                            <input
                              type="text"
                              value={paramValues[param] || ''}
                              onChange={(e) =>
                                setParamValues({
                                  ...paramValues,
                                  [param]: e.target.value
                                })
                              }
                              placeholder={`Enter value for ${param}...`}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-sky-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Command Preview */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <label className="text-slate-400 block mb-1 font-medium">Command Preview</label>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-sky-300 whitespace-pre-wrap break-all flex-1 selection:bg-sky-900 overflow-y-auto">
                      {getResolvedCommand()}
                    </div>
                  </div>

                  {/* Target Host / Session Destination Bar */}
                  {availableSessions !== undefined && (
                    <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2.5 flex items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Server className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                          {availableSessions.length > 0 ? 'Target Session:' : 'Connect Host:'}
                        </span>

                        {availableSessions.length > 0 ? (
                          availableSessions.length === 1 ? (
                            <span className="px-2.5 py-1 rounded bg-slate-900 text-sky-300 font-mono text-xs border border-slate-700 truncate">
                              {availableSessions[0].title}
                            </span>
                          ) : (
                            <select
                              value={selectedSessionId}
                              onChange={(e) => {
                                setSelectedSessionId(e.target.value);
                                setErrorMessage(null);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-sky-500 font-mono truncate flex-1 min-w-0"
                            >
                              {availableSessions.map((s) => (
                                <option key={s.sessionId} value={s.sessionId}>
                                  {s.title}
                                </option>
                              ))}
                            </select>
                          )
                        ) : profiles && profiles.length > 0 ? (
                          <select
                            value={selectedProfileId}
                            onChange={(e) => {
                              setSelectedProfileId(e.target.value);
                              setErrorMessage(null);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-sky-500 font-mono truncate flex-1 min-w-0"
                          >
                            {profiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.display_name} ({p.hostname})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-amber-400 text-xs">No host profiles configured</span>
                        )}
                      </div>

                      {/* Status indicator pill */}
                      {availableSessions.length > 0 ? (
                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full shrink-0 font-medium whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active Session
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/80 px-2.5 py-1 rounded-full shrink-0 font-medium whitespace-nowrap">
                          Will Connect & Run
                        </span>
                      )}
                    </div>
                  )}

                  {/* Inline Error Message */}
                  {errorMessage && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 text-xs shrink-0">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Bottom Actions Row */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(activeSnippet, getResolvedCommand())}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 transition font-medium cursor-pointer flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Command</span>
                    </button>

                    {(onExecuteSnippet || onConnectAndExecute) && (
                      <button
                        type="button"
                        onClick={handleExecute}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-md text-xs whitespace-nowrap shrink-0"
                      >
                        <Terminal className="w-4 h-4" />
                        <span>
                          {availableSessions !== undefined && availableSessions.length === 0 && profiles && profiles.length > 0
                            ? 'Connect & Run'
                            : 'Run in Terminal'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                  <Code className="w-8 h-8 opacity-40 text-slate-400" />
                  <p className="text-xs">Select a snippet from the list to preview, customize parameters, or run.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
