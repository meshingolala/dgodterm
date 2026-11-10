import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Info, HelpCircle, X } from 'lucide-react';

export interface Win11DialogOptions {
  isOpen: boolean;
  type?: 'confirm' | 'prompt' | 'alert';
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  primaryText?: string;
  secondaryText?: string;
  isDestructive?: boolean;
  badge?: string;
  onConfirm?: (inputValue?: string) => void;
  onCancel?: () => void;
}

interface Windows11DialogProps {
  dialog: Win11DialogOptions | null;
  onClose: () => void;
}

export const Windows11Dialog: React.FC<Windows11DialogProps> = ({ dialog, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dialog?.isOpen) {
      setInputValue(dialog.defaultValue || '');
      setTimeout(() => {
        if (dialog.type === 'prompt' && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else if (primaryBtnRef.current) {
          primaryBtnRef.current.focus();
        }
      }, 50);
    }
  }, [dialog?.isOpen, dialog?.defaultValue, dialog?.type]);

  if (!dialog || !dialog.isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dialog.onCancel?.();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      dialog.onConfirm?.(inputValue);
      onClose();
    }
  };

  const handleConfirm = () => {
    dialog.onConfirm?.(inputValue);
    onClose();
  };

  const handleCancel = () => {
    dialog.onCancel?.();
    onClose();
  };

  const isDestructive = dialog.isDestructive;
  const isPrompt = dialog.type === 'prompt';
  const isAlert = dialog.type === 'alert';

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/65 backdrop-blur-[6px] flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPrompt) {
          handleCancel();
        }
      }}
    >
      {/* Windows 11 Fluent ContentDialog Window */}
      <div
        className="w-full max-w-[460px] win11-dialog-card rounded-[10px] shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        style={{
          fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
          backgroundColor: 'var(--dgod-bg-surface)',
          color: 'var(--dgod-text-primary)',
          borderColor: 'var(--dgod-border-strong)',
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="win11-dialog-title"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {isDestructive ? (
              <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              </div>
            ) : isPrompt ? (
              <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                <Info className="w-3.5 h-3.5 text-blue-500" />
              </div>
            )}
            <h3
              id="win11-dialog-title"
              className="text-[15px] font-semibold tracking-normal truncate win11-dialog-title"
              style={{ color: 'var(--dgod-text-primary)' }}
            >
              {dialog.title}
            </h3>
            {dialog.badge && (
              <span
                className="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded truncate shrink-0 max-w-[150px] win11-dialog-badge"
                style={{
                  backgroundColor: 'var(--dgod-bg-surface-elevated)',
                  color: 'var(--dgod-text-primary)',
                  borderColor: 'var(--dgod-border-strong)',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                {dialog.badge}
              </span>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="w-7 h-7 rounded-[4px] hover:bg-[var(--dgod-bg-surface-elevated)] flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2 win11-dialog-close-btn"
            style={{ color: 'var(--dgod-text-secondary)' }}
            title="Dismiss (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="px-6 py-3 flex flex-col gap-3">
          <p
            className="text-[13px] leading-relaxed whitespace-pre-line font-normal win11-dialog-message"
            style={{ color: 'var(--dgod-text-primary)' }}
          >
            {dialog.message}
          </p>

          {isPrompt && (
            <div className="mt-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={dialog.placeholder || 'Enter value...'}
                className="w-full rounded-[4px] px-3 py-2 text-[13px] outline-none transition-all shadow-inner win11-dialog-input"
                style={{
                  backgroundColor: 'var(--dgod-bg-app)',
                  color: 'var(--dgod-text-primary)',
                  borderColor: 'var(--dgod-border-strong)',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              />
            </div>
          )}
        </div>

        {/* Windows 11 Fluent Command / Action Bar */}
        <div
          className="win11-dialog-footer px-6 py-3.5 flex items-center justify-end gap-2.5"
          style={{
            backgroundColor: 'var(--dgod-bg-surface-elevated)',
            borderTopColor: 'var(--dgod-border-subtle)',
            borderTopWidth: '1px',
            borderTopStyle: 'solid'
          }}
        >
          {!isAlert && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 text-[12px] font-medium rounded-[4px] transition-colors cursor-pointer shadow-sm win11-dialog-secondary-btn"
              style={{
                backgroundColor: 'var(--dgod-bg-surface)',
                color: 'var(--dgod-text-primary)',
                borderColor: 'var(--dgod-border-strong)',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              {dialog.secondaryText || 'Cancel'}
            </button>
          )}

          <button
            ref={primaryBtnRef}
            type="button"
            onClick={handleConfirm}
            style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
            className={`px-5 py-1.5 text-[12px] font-semibold text-white rounded-[4px] border transition-all cursor-pointer shadow-sm win11-dialog-primary-btn ${
              isDestructive
                ? 'bg-[#c42b1c] hover:bg-[#b82415] active:bg-[#a31f12] border-rose-600/40 text-white'
                : 'bg-[#0078d4] hover:bg-[#1084d8] active:bg-[#006cc1] border-blue-400/40 text-white'
            }`}
          >
            <span style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>
              {dialog.primaryText || (isDestructive ? 'Confirm' : isAlert ? 'OK' : 'Save')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
