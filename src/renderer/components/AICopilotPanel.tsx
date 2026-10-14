import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Copy,
  Check,
  Terminal,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Key,
  BookOpen,
  HelpCircle,
  Play
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard-utils';

interface AICopilotPanelProps {
  onClose: () => void;
  onInsertCommand?: (command: string, run: boolean) => void;
  initialText?: string;
  initialMode?: 'generate' | 'explain';
  context?: { hostname?: string; username?: string };
}

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({
  onClose,
  onInsertCommand,
  initialText = '',
  initialMode = 'generate',
  context
}) => {
  const [mode, setMode] = useState<'generate' | 'explain'>(initialMode);
  const [prompt, setPrompt] = useState(initialText);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('dgodterm_gemini_api_key') || '');
  const [showKeySettings, setShowKeySettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Result state
  const [generatedResult, setGeneratedResult] = useState<{
    command: string;
    explanation: string;
    risk: 'safe' | 'caution' | 'destructive';
    warnings: string[];
    source: 'gemini' | 'offline';
  } | null>(null);

  const [explainResult, setExplainResult] = useState<{
    summary: string;
    details: string[];
    suggestedFix?: string;
    source: 'gemini' | 'offline';
  } | null>(null);

  const handleSaveApiKey = (keyVal: string) => {
    setApiKey(keyVal);
    localStorage.setItem('dgodterm_gemini_api_key', keyVal.trim());
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('dgodterm_gemini_api_key');
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);

    try {
      if (mode === 'generate') {
        const res = await (window as any).dgodterm?.invokeFeature('ai:generate-command', {
          prompt: prompt.trim(),
          apiKey: apiKey.trim() || undefined,
          context
        });
        setGeneratedResult(res);
      } else {
        const res = await (window as any).dgodterm?.invokeFeature('ai:explain', {
          text: prompt.trim(),
          apiKey: apiKey.trim() || undefined,
          mode: 'error'
        });
        setExplainResult(res);
      }
    } catch (err: any) {
      alert(`AI Copilot Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[440px] bg-slate-900 border-l border-slate-700/80 shadow-2xl z-50 flex flex-col text-xs overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/80 text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              AI Command Copilot
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-bold border ${
                  apiKey.trim()
                    ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {apiKey.trim() ? 'Gemini 2.5' : 'Offline'}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Natural language to bash & error explainer</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowKeySettings(!showKeySettings)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Configure Gemini API Key"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* API Key Drawer */}
      {showKeySettings && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-300">Google Gemini API Key</span>
            <span className="text-slate-500 text-[10px]">Optional (Falls back to offline rules)</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleSaveApiKey(e.target.value)}
              placeholder="Paste AI Studio API key..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:border-sky-500"
            />
            {apiKey && (
              <button
                onClick={handleClearApiKey}
                className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400 text-[11px]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="p-2 border-b border-slate-800 bg-slate-950/40 flex gap-1 shrink-0">
        <button
          onClick={() => {
            setMode('generate');
            setPrompt('');
          }}
          className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 transition font-medium ${
            mode === 'generate'
              ? 'bg-sky-600 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Ask (Natural Language)</span>
        </button>
        <button
          onClick={() => {
            setMode('explain');
            setPrompt('');
          }}
          className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 transition font-medium ${
            mode === 'explain'
              ? 'bg-sky-600 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Explain Command / Error</span>
        </button>
      </div>

      {/* Input Form */}
      <div className="p-3 border-b border-slate-800 space-y-2 shrink-0">
        <div className="relative">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') handleSubmit();
            }}
            placeholder={
              mode === 'generate'
                ? 'e.g. Find all docker logs over 200MB, or list listening TCP ports with process names...'
                : 'Paste terminal output, error message, or shell command to diagnose...'
            }
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:border-sky-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Press Ctrl+Enter to submit</span>
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-slate-950 font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            <Send className="w-3 h-3" />
            <span>{loading ? 'Thinking...' : 'Submit'}</span>
          </button>
        </div>
      </div>

      {/* Response Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
            <Sparkles className="w-6 h-6 animate-pulse text-sky-400" />
            <span>Analyzing sysadmin intent...</span>
          </div>
        )}

        {/* Generate Mode Output */}
        {!loading && mode === 'generate' && generatedResult && (
          <div className="space-y-3">
            {/* Risk Badge */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Generated Command:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  generatedResult.risk === 'destructive'
                    ? 'bg-rose-950 text-rose-300 border-rose-800'
                    : generatedResult.risk === 'caution'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}
              >
                {generatedResult.risk === 'destructive' ? (
                  <ShieldAlert className="w-3 h-3" />
                ) : generatedResult.risk === 'caution' ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <ShieldCheck className="w-3 h-3" />
                )}
                {generatedResult.risk}
              </span>
            </div>

            {/* Command Box */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-sky-300 whitespace-pre-wrap break-all selection:bg-sky-900">
              {generatedResult.command}
            </div>

            {/* Explanation */}
            <p className="text-slate-300 text-xs leading-relaxed">{generatedResult.explanation}</p>

            {/* Warnings */}
            {generatedResult.warnings?.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-900/60 text-amber-300 space-y-1">
                {generatedResult.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={async () => {
                  await copyTextToClipboard(generatedResult.command);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium cursor-pointer flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {onInsertCommand && (
                <>
                  <button
                    onClick={() => onInsertCommand(generatedResult.command, false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 transition font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Insert</span>
                  </button>

                  <button
                    onClick={() => onInsertCommand(generatedResult.command, true)}
                    disabled={generatedResult.risk === 'destructive'}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-md"
                    title={generatedResult.risk === 'destructive' ? 'Direct execution disabled for destructive commands' : 'Execute now in terminal'}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Explain Mode Output */}
        {!loading && mode === 'explain' && explainResult && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-sky-400" />
              {explainResult.summary}
            </h3>

            <div className="space-y-1.5 text-slate-300">
              {explainResult.details?.map((d, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                  <span>{d}</span>
                </div>
              ))}
            </div>

            {explainResult.suggestedFix && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-lg space-y-1.5">
                <span className="font-semibold text-emerald-300 text-[11px] block">Suggested Fix:</span>
                <p className="text-emerald-200 text-xs font-mono">{explainResult.suggestedFix}</p>
                {onInsertCommand && (
                  <button
                    onClick={() => onInsertCommand(explainResult.suggestedFix!, false)}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-[11px] mt-1"
                  >
                    Insert Fix
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && !generatedResult && !explainResult && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
            <Sparkles className="w-8 h-8 opacity-30 mb-2" />
            <p>Ask a question or paste terminal output to get instant AI assistance.</p>
          </div>
        )}
      </div>
    </div>
  );
};
