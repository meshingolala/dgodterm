import React from 'react';
import { AlertCircle, ClipboardCheck, X } from 'lucide-react';

interface ClipboardPasteModalProps {
  content: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ClipboardPasteModal: React.FC<ClipboardPasteModalProps> = ({ content, onConfirm, onCancel }) => {
  const lineCount = content.split(/\r\n|\r|\n/).length;
  const hasMultipleLines = lineCount > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Review Multi-line Paste</h3>
              <p className="text-xs text-slate-400">
                Pasting multi-line text may automatically execute commands in the remote shell.
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
            <span>Buffer Preview ({lineCount} lines, {content.length} characters):</span>
          </div>
          <div className="max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-amber-200 whitespace-pre-wrap select-all">
            {content}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition flex items-center gap-2"
          >
            <ClipboardCheck className="w-4 h-4" />
            Confirm Paste
          </button>
        </div>
      </div>
    </div>
  );
};
