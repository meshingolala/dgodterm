import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption<T = string | number> {
  value: T;
  label: string;
  description?: string;
  badge?: string;
  badgeVariant?: 'red' | 'amber' | 'emerald' | 'sky' | 'indigo' | 'slate';
  dotColor?: 'red' | 'amber' | 'emerald' | 'sky' | 'indigo' | 'slate';
  icon?: React.ReactNode;
}

interface CustomSelectProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  themeVariant?: 'auto' | 'default' | 'danger' | 'warning' | 'success';
}

const BADGE_STYLES: Record<string, string> = {
  red: 'bg-red-500/20 text-red-300 border-red-500/30',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  sky: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  slate: 'bg-slate-700/50 text-slate-300 border-slate-600/40',
};

const DOT_STYLES: Record<string, string> = {
  red: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]',
  amber: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
  emerald: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]',
  sky: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]',
  indigo: 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.7)]',
  slate: 'bg-slate-400',
};

export function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  buttonClassName = '',
  themeVariant = 'auto'
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Determine button theme based on selectedOption or themeVariant
  const getThemeStyles = () => {
    if (themeVariant === 'danger' || (themeVariant === 'auto' && selectedOption?.dotColor === 'red')) {
      return 'bg-red-950/40 border-red-500/50 text-red-200 hover:border-red-400/80 hover:bg-red-950/60 focus:ring-red-500/40';
    }
    if (themeVariant === 'warning' || (themeVariant === 'auto' && selectedOption?.dotColor === 'amber')) {
      return 'bg-amber-950/40 border-amber-500/50 text-amber-200 hover:border-amber-400/80 hover:bg-amber-950/60 focus:ring-amber-500/40';
    }
    if (themeVariant === 'success' || (themeVariant === 'auto' && selectedOption?.dotColor === 'emerald')) {
      return 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 hover:border-emerald-400/80 hover:bg-emerald-950/60 focus:ring-emerald-500/40';
    }
    return 'bg-slate-950 border-slate-700/80 text-slate-200 hover:border-slate-500 hover:bg-slate-900 focus:ring-sky-500/30';
  };

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 ${getThemeStyles()} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer shadow-sm'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {selectedOption?.dotColor && (
            <span
              className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                DOT_STYLES[selectedOption.dotColor] || 'bg-slate-400'
              }`}
            />
          )}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {selectedOption?.badge && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${
                BADGE_STYLES[selectedOption.badgeVariant || 'slate']
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </div>
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[220px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-xl shadow-2xl p-1 space-y-0.5 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left flex items-start justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-all duration-100 ${
                  isSelected
                    ? 'bg-slate-800 text-white font-medium border border-slate-600/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {option.dotColor ? (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                        DOT_STYLES[option.dotColor] || 'bg-slate-400'
                      }`}
                    />
                  ) : option.icon ? (
                    <span className="shrink-0 mt-0.5 text-slate-400">{option.icon}</span>
                  ) : null}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{option.label}</span>
                      {option.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold uppercase tracking-wider ${
                            BADGE_STYLES[option.badgeVariant || 'slate']
                          }`}
                        >
                          {option.badge}
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-tight line-clamp-2 font-normal">
                        {option.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 ml-2 mt-0.5">
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
