import { ITheme } from '@xterm/xterm';

export interface TerminalThemeDefinition extends ITheme {
  id: string;
  name: string;
  description: string;
}

export interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: 'normal' | '500' | '600' | 'bold';
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  cursorColor: string;
  themeId: string;
  scrollback: number;
  copyOnSelect: boolean;
  rightClickPaste: boolean;
  windowPadding: number;
  audibleBell: boolean;
}

export interface GeneralUiSettings {
  appTheme?: 'dark' | 'light';
  accentColor: 'sky' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan';
  uiDensity: 'compact' | 'comfortable' | 'spacious';
  sidebarWidth: number;
  showStatusBar: boolean;
  tabStyle: 'rounded' | 'modern' | 'minimal';
  enableBlur: boolean;
  enableAnimations: boolean;
  confirmCloseSession: boolean;
  appFontFamily: string;
  appFontSize: number;
  fontAntialiasing: 'antialiased' | 'subpixel' | 'none' | 'ultra';
  fontStrokeWeight?: 'normal' | 'medium' | 'strong';
}

export const TERMINAL_THEMES: Record<string, TerminalThemeDefinition> = {
  'dgod-dark': {
    id: 'dgod-dark',
    name: 'Dgod Midnight (Default)',
    description: 'Deep midnight blue with high-contrast sky accents',
    background: '#090d16',
    foreground: '#e2e8f0',
    cursor: '#38bdf8',
    selectionBackground: 'rgba(56, 189, 248, 0.3)',
    black: '#0f172a',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#38bdf8',
    white: '#f8fafc',
    brightBlack: '#475569',
    brightRed: '#ef4444',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#a855f7',
    brightCyan: '#06b6d4',
    brightWhite: '#ffffff'
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'A clean, dark Visual Studio Code theme that celebrates Tokyo neon lights',
    background: '#1a1b26',
    foreground: '#a9b1d6',
    cursor: '#c0caf5',
    selectionBackground: 'rgba(122, 162, 247, 0.35)',
    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#414868',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5'
  },
  'dracula': {
    id: 'dracula',
    name: 'Dracula',
    description: 'Dark theme with vivid pastel purple, pink, and turquoise accents',
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selectionBackground: 'rgba(68, 71, 90, 0.6)',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff'
  },
  'one-dark': {
    id: 'one-dark',
    name: 'One Dark Pro',
    description: 'Atom iconic iconic subtle dark palette with balanced contrast',
    background: '#1e222a',
    foreground: '#abb2bf',
    cursor: '#528bff',
    selectionBackground: 'rgba(62, 68, 81, 0.6)',
    black: '#1e222a',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#be5046',
    brightGreen: '#98c379',
    brightYellow: '#d19a66',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff'
  },
  'nord': {
    id: 'nord',
    name: 'Nord',
    description: 'An arctic, north-bluish clean and elegant color palette',
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#88c0d0',
    selectionBackground: 'rgba(67, 76, 94, 0.7)',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4'
  },
  'gruvbox': {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    description: 'Retro warm groove dark theme with earthy amber and green tones',
    background: '#282828',
    foreground: '#ebdbb2',
    cursor: '#ebdbb2',
    selectionBackground: 'rgba(80, 73, 69, 0.7)',
    black: '#282828',
    red: '#cc241d',
    green: '#98971a',
    yellow: '#d79921',
    blue: '#458588',
    magenta: '#b16286',
    cyan: '#689d6a',
    white: '#a89984',
    brightBlack: '#928374',
    brightRed: '#fb4934',
    brightGreen: '#b8bb26',
    brightYellow: '#fabd2f',
    brightBlue: '#83a598',
    brightMagenta: '#d3869b',
    brightCyan: '#8ec07c',
    brightWhite: '#ebdbb2'
  },
  'monokai': {
    id: 'monokai',
    name: 'Monokai Pro',
    description: 'High-contrast vibrant developer favorite with energetic highlights',
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    selectionBackground: 'rgba(73, 72, 62, 0.8)',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5'
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    description: 'Precision colors engineered for optical contrast and low eye-strain',
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    selectionBackground: 'rgba(7, 54, 66, 0.8)',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3'
  },
  'cyberpunk': {
    id: 'cyberpunk',
    name: 'Cyberpunk Matrix',
    description: 'High-visibility phosphor green terminal on obsidian black',
    background: '#0a0e14',
    foreground: '#00ff66',
    cursor: '#00ff66',
    selectionBackground: 'rgba(0, 255, 102, 0.3)',
    black: '#01060e',
    red: '#ea6c73',
    green: '#00ff66',
    yellow: '#f9af4f',
    blue: '#53bdfa',
    magenta: '#fae994',
    cyan: '#90e1c6',
    white: '#c7c7c7',
    brightBlack: '#686868',
    brightRed: '#f07178',
    brightGreen: '#39ff14',
    brightYellow: '#ffb454',
    brightBlue: '#59c2ff',
    brightMagenta: '#ffee99',
    brightCyan: '#95e6cb',
    brightWhite: '#ffffff'
  },
  'oled-black': {
    id: 'oled-black',
    name: 'Pure OLED Black',
    description: 'True pitch black `#000000` with pure white text and crisp cyan cursor',
    background: '#000000',
    foreground: '#f1f5f9',
    cursor: '#38bdf8',
    selectionBackground: 'rgba(56, 189, 248, 0.35)',
    black: '#18181b',
    red: '#f87171',
    green: '#4ade80',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#38bdf8',
    white: '#f4f4f5',
    brightBlack: '#52525b',
    brightRed: '#ef4444',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#a855f7',
    brightCyan: '#06b6d4',
    brightWhite: '#ffffff'
  }
};

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontFamily: "'Fira Code', 'Courier New', monospace",
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 'normal',
  cursorStyle: 'block',
  cursorBlink: true,
  cursorColor: '#38bdf8',
  themeId: 'dgod-dark',
  scrollback: 5000,
  copyOnSelect: false,
  rightClickPaste: true,
  windowPadding: 8,
  audibleBell: false
};

export const DEFAULT_GENERAL_UI_SETTINGS: GeneralUiSettings = {
  appTheme: 'dark',
  accentColor: 'sky',
  uiDensity: 'comfortable',
  sidebarWidth: 260,
  showStatusBar: true,
  tabStyle: 'rounded',
  enableBlur: true,
  enableAnimations: true,
  confirmCloseSession: true,
  appFontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  appFontSize: 13,
  fontAntialiasing: 'subpixel',
  fontStrokeWeight: 'medium'
};

const STORAGE_KEY_TERMINAL = 'dgodterm_terminal_settings';
const STORAGE_KEY_UI = 'dgodterm_ui_settings';

export function getTerminalSettings(): TerminalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TERMINAL);
    if (raw) {
      return { ...DEFAULT_TERMINAL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse terminal settings from storage:', e);
  }
  return { ...DEFAULT_TERMINAL_SETTINGS };
}

export function saveTerminalSettings(settings: TerminalSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_TERMINAL, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('dgodterm:terminal-settings-updated', { detail: settings }));
  } catch (e) {
    console.error('Failed to save terminal settings to storage:', e);
  }
}

export function getGeneralUiSettings(): GeneralUiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UI);
    if (raw) {
      return { ...DEFAULT_GENERAL_UI_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse UI settings from storage:', e);
  }
  return { ...DEFAULT_GENERAL_UI_SETTINGS };
}

export function saveGeneralUiSettings(settings: GeneralUiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_UI, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('dgodterm:ui-settings-updated', { detail: settings }));
  } catch (e) {
    console.error('Failed to save UI settings to storage:', e);
  }
}

export interface SessionSecuritySettings {
  autoLockoutEnabled: boolean;
  screenLockTimeoutMinutes: number;
  passwordRetentionMinutes: number;
  keepTabsAliveInBackground: boolean;
  lockOnOsLock: boolean;
}

export const DEFAULT_SESSION_SECURITY_SETTINGS: SessionSecuritySettings = {
  autoLockoutEnabled: true,
  screenLockTimeoutMinutes: 15,
  passwordRetentionMinutes: -1,
  keepTabsAliveInBackground: true,
  lockOnOsLock: true
};

export const STORAGE_KEY_SESSION = 'dgodterm_session_settings';

export function getSessionSecuritySettings(): SessionSecuritySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        autoLockoutEnabled: parsed.autoLockoutEnabled !== undefined ? Boolean(parsed.autoLockoutEnabled) : (parsed.screenLockTimeoutMinutes !== 0),
        screenLockTimeoutMinutes: typeof parsed.screenLockTimeoutMinutes === 'number' ? parsed.screenLockTimeoutMinutes : 15,
        passwordRetentionMinutes: typeof parsed.passwordRetentionMinutes === 'number' ? parsed.passwordRetentionMinutes : -1,
        keepTabsAliveInBackground: parsed.keepTabsAliveInBackground !== undefined ? Boolean(parsed.keepTabsAliveInBackground) : true,
        lockOnOsLock: parsed.lockOnOsLock !== undefined ? Boolean(parsed.lockOnOsLock) : true
      };
    }
  } catch (e) {
    console.error('Failed to parse session settings from storage:', e);
  }
  return { ...DEFAULT_SESSION_SECURITY_SETTINGS };
}

export function saveSessionSecuritySettings(settings: SessionSecuritySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('dgodterm:session-settings-updated', { detail: settings }));
    window.dispatchEvent(new Event('dgodterm:settings-updated'));
  } catch (e) {
    console.error('Failed to save session settings to storage:', e);
  }
}
