import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { TERMINAL_THEMES, TerminalThemeDefinition } from '../settings/settings-manager';

interface SessionThemeDropdownProps {
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  align?: 'left' | 'right';
  className?: string;
  showLabel?: boolean;
}

export const SessionThemeDropdown: React.FC<SessionThemeDropdownProps> = ({
  currentThemeId,
  onSelectTheme,
  align = 'right',
  className = '',
  showLabel = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeThemeDef: TerminalThemeDefinition =
    TERMINAL_THEMES[currentThemeId] || TERMINAL_THEMES['dgod-dark'];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('click', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isOpen]);

  const themesList = Object.values(TERMINAL_THEMES);

  return (
    <div className={`relative shrink-0 z-40 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold shadow-sm transition cursor-pointer ${
          isOpen
            ? 'bg-purple-950/90 border-purple-500/70 text-purple-200 shadow-purple-950/50'
            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
        }`}
        title={`Current Session Theme: ${activeThemeDef.name}. Click to change theme.`}
      >
        <Palette className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        {showLabel && (
          <span className="max-w-[110px] truncate text-slate-200">
            {activeThemeDef.name.replace(/ \(Default\)/, '')}
          </span>
        )}
        <span
          className="w-2.5 h-2.5 rounded-full border border-slate-600/80 shrink-0 shadow-inner"
          style={{ backgroundColor: activeThemeDef.background }}
          title={`Background: ${activeThemeDef.background}`}
        />
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } top-full mt-1.5 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 z-50 animate-in fade-in zoom-in-95 duration-100 select-none pointer-events-auto`}
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
              <Palette className="w-3 h-3 text-purple-400" />
              <span>Session Theme</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-500/30 text-purple-300 font-mono">
              {themesList.length} Inbuilt
            </span>
          </div>

          {/* Theme List */}
          <div className="max-h-72 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-700">
            {themesList.map((theme) => {
              const isSelected = theme.id === currentThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? 'bg-purple-950/60 text-purple-200 border-l-2 border-purple-400'
                      : 'hover:bg-slate-800/80 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Tri-color preview swatch dots: background, foreground, accent */}
                    <div className="flex items-center -space-x-1 shrink-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-700 shadow-sm z-30"
                        style={{ backgroundColor: theme.background }}
                        title="Background color"
                      />
                      <span
                        className="w-3 h-3 rounded-full border border-slate-700 shadow-sm z-20"
                        style={{ backgroundColor: theme.foreground }}
                        title="Foreground text color"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-slate-700 shadow-sm z-10"
                        style={{ backgroundColor: theme.cursor }}
                        title="Cursor / Accent color"
                      />
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-xs truncate">{theme.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{theme.description}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
