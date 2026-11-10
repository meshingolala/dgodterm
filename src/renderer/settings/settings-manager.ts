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
  backgroundOpacity?: number;
  backdropStyle?: 'desktop' | 'cyber-grid' | 'aurora' | 'deep-space' | 'matrix' | 'solid';
}

export interface AppThemePreset {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  background: string;
  foreground: string;
  accent: string;
  terminalThemeId?: string;
}

export interface GeneralUiSettings {
  appTheme?: 'dark' | 'light' | 'windows11';
  themeMode?: 'system' | 'light' | 'dark';
  contrast?: 'default' | 'strong';
  themePreset?: string;
  customBackground?: string;
  customForeground?: string;
  customAccent?: string;
  conversationSteps?: 'default' | 'verbose';
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

export const APP_THEME_PRESETS: Record<string, AppThemePreset> = {
  'gruvbox-material': {
    id: 'gruvbox-material',
    name: 'Gruvbox Material',
    mode: 'dark',
    background: '#2D2F30',
    foreground: '#D4BE98',
    accent: '#E78A4E',
    terminalThemeId: 'gruvbox-material'
  },
  'antigravity-dark': {
    id: 'antigravity-dark',
    name: 'Antigravity Carbon',
    mode: 'dark',
    background: '#1E1F22',
    foreground: '#E2E4E9',
    accent: '#38BDF8',
    terminalThemeId: 'dgod-dark'
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    mode: 'dark',
    background: '#1A1B26',
    foreground: '#C0CAF5',
    accent: '#7AA2F7',
    terminalThemeId: 'tokyo-night'
  },
  'catppuccin-mocha': {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    mode: 'dark',
    background: '#1E1E2E',
    foreground: '#CDD6F4',
    accent: '#CBA6F7',
    terminalThemeId: 'catppuccin-mocha'
  },
  'dracula': {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    background: '#282A36',
    foreground: '#F8F8F2',
    accent: '#BD93F9',
    terminalThemeId: 'dracula'
  },
  'one-dark': {
    id: 'one-dark',
    name: 'One Dark Pro',
    mode: 'dark',
    background: '#21252B',
    foreground: '#ABB2BF',
    accent: '#61AFEF',
    terminalThemeId: 'one-dark'
  },
  'nord': {
    id: 'nord',
    name: 'Nord',
    mode: 'dark',
    background: '#2E3440',
    foreground: '#D8DEE9',
    accent: '#88C0D0',
    terminalThemeId: 'nord'
  },
  'rose-pine': {
    id: 'rose-pine',
    name: 'Rosé Pine',
    mode: 'dark',
    background: '#191724',
    foreground: '#E0DEF4',
    accent: '#EBBCBA',
    terminalThemeId: 'dracula'
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    mode: 'dark',
    background: '#002B36',
    foreground: '#93A1A1',
    accent: '#2AA198',
    terminalThemeId: 'solarized-dark'
  },
  'monokai-pro': {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    mode: 'dark',
    background: '#2D2A2E',
    foreground: '#FCFCFA',
    accent: '#FFD866',
    terminalThemeId: 'monokai'
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    mode: 'dark',
    background: '#0D1117',
    foreground: '#E6EDF3',
    accent: '#58A6FF',
    terminalThemeId: 'dgod-dark'
  },
  'gruvbox-light': {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    mode: 'light',
    background: '#FBF1C7',
    foreground: '#3C3836',
    accent: '#D65D0E',
    terminalThemeId: 'gruvbox-light'
  },
  'catppuccin-latte': {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    mode: 'light',
    background: '#EFF1F5',
    foreground: '#4C4F69',
    accent: '#8839EF',
    terminalThemeId: 'gruvbox-light'
  },
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    background: '#FDF6E3',
    foreground: '#586E75',
    accent: '#268BD2',
    terminalThemeId: 'solarized-light'
  },
  'github-light': {
    id: 'github-light',
    name: 'GitHub Light',
    mode: 'light',
    background: '#FFFFFF',
    foreground: '#1F2328',
    accent: '#0969DA',
    terminalThemeId: 'gruvbox-light'
  }
};

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
  },
  'gruvbox-material': {
    id: 'gruvbox-material',
    name: 'Gruvbox Material (Antigravity)',
    description: 'Warm Antigravity studio palette with soft earthy tones and orange accent',
    background: '#2D2F30',
    foreground: '#D4BE98',
    cursor: '#E78A4E',
    selectionBackground: 'rgba(231, 138, 78, 0.28)',
    black: '#242627',
    red: '#EA6962',
    green: '#A9B665',
    yellow: '#D8A657',
    blue: '#7DAEA3',
    magenta: '#D3869B',
    cyan: '#89B482',
    white: '#D4BE98',
    brightBlack: '#5A524C',
    brightRed: '#EA6962',
    brightGreen: '#A9B665',
    brightYellow: '#D8A657',
    brightBlue: '#7DAEA3',
    brightMagenta: '#D3869B',
    brightCyan: '#89B482',
    brightWhite: '#EBDBB2'
  },
  'gruvbox-light': {
    id: 'gruvbox-light',
    name: 'Gruvbox Light (Antigravity)',
    description: 'Warm natural light palette matching the Antigravity light theme',
    background: '#FBF1C7',
    foreground: '#3C3836',
    cursor: '#D65D0E',
    selectionBackground: 'rgba(214, 93, 14, 0.25)',
    black: '#EBDBB2',
    red: '#C14A4A',
    green: '#6C782E',
    yellow: '#B47109',
    blue: '#45707A',
    magenta: '#945E80',
    cyan: '#4C7A5D',
    white: '#3C3836',
    brightBlack: '#928374',
    brightRed: '#C14A4A',
    brightGreen: '#6C782E',
    brightYellow: '#B47109',
    brightBlue: '#45707A',
    brightMagenta: '#945E80',
    brightCyan: '#4C7A5D',
    brightWhite: '#282828'
  },
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    description: 'Classic optical low-contrast solarized light theme',
    background: '#FDF6E3',
    foreground: '#586E75',
    cursor: '#268BD2',
    selectionBackground: 'rgba(38, 139, 210, 0.25)',
    black: '#073642',
    red: '#DC322F',
    green: '#859900',
    yellow: '#B58900',
    blue: '#268BD2',
    magenta: '#D33682',
    cyan: '#2AA198',
    white: '#EEE8D5',
    brightBlack: '#002B36',
    brightRed: '#CB4B16',
    brightGreen: '#586E75',
    brightYellow: '#657B83',
    brightBlue: '#839496',
    brightMagenta: '#6C71C4',
    brightCyan: '#93A1A1',
    brightWhite: '#FDF6E3'
  }
};

export function hexToRgba(hexOrRgba: string, alpha: number): string {
  if (!hexOrRgba) return `rgba(9, 13, 22, ${alpha})`;
  if (hexOrRgba.startsWith('rgba')) {
    return hexOrRgba.replace(/[\d\.]+\)$/, `${alpha})`);
  }
  if (hexOrRgba.startsWith('rgb(')) {
    return hexOrRgba.replace('rgb(', 'rgba(').replace(/\)$/, `, ${alpha})`);
  }
  let c = hexOrRgba.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return hexOrRgba;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  let c = (hex || '#2D2F30').replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return [45, 47, 48];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function mixHexColors(hexA: string, hexB: string, weightA: number): string {
  const [r1, g1, b1] = hexToRgbTuple(hexA);
  const [r2, g2, b2] = hexToRgbTuple(hexB);
  const w = Math.max(0, Math.min(1, weightA));
  return rgbToHex(r1 * w + r2 * (1 - w), g1 * w + g2 * (1 - w), b1 * w + b2 * (1 - w));
}

export function shiftHexBrightness(hex: string, delta: number): string {
  const [r, g, b] = hexToRgbTuple(hex);
  return rgbToHex(r + delta, g + delta, b + delta);
}

export function applyAppThemeToDom(settings: GeneralUiSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const preset = APP_THEME_PRESETS[settings.themePreset || 'gruvbox-material'] || APP_THEME_PRESETS['gruvbox-material'];

  const effectiveMode =
    settings.themeMode === 'light' || settings.appTheme === 'light'
      ? 'light'
      : settings.themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';

  const isStrong = (settings.contrast || 'strong') === 'strong';
  const rawBg = settings.customBackground || preset.background || '#2D2F30';
  const rawFg = settings.customForeground || preset.foreground || '#D4BE98';
  const rawAccent = settings.customAccent || preset.accent || '#E78A4E';

  const bgApp = isStrong
    ? effectiveMode === 'dark'
      ? shiftHexBrightness(rawBg, -5)
      : shiftHexBrightness(rawBg, 4)
    : rawBg;

  const bgSidebar =
    effectiveMode === 'dark'
      ? shiftHexBrightness(bgApp, isStrong ? -11 : -8)
      : shiftHexBrightness(bgApp, isStrong ? -9 : -6);

  const bgSurface =
    effectiveMode === 'dark'
      ? shiftHexBrightness(bgApp, isStrong ? 9 : 6)
      : shiftHexBrightness(bgApp, isStrong ? -5 : -3);

  const bgSurfaceElevated =
    effectiveMode === 'dark'
      ? shiftHexBrightness(bgApp, isStrong ? 18 : 13)
      : shiftHexBrightness(bgApp, isStrong ? -12 : -8);

  const textPrimary = isStrong
    ? effectiveMode === 'dark'
      ? shiftHexBrightness(rawFg, 10)
      : shiftHexBrightness(rawFg, -12)
    : rawFg;

  const textSecondary = mixHexColors(textPrimary, bgApp, isStrong ? 0.78 : 0.70);
  const textMuted = mixHexColors(textPrimary, bgApp, isStrong ? 0.54 : 0.46);

  const borderMain = hexToRgba(textPrimary, isStrong ? 0.18 : 0.13);
  const borderSubtle = hexToRgba(textPrimary, isStrong ? 0.11 : 0.07);
  const borderStrong = hexToRgba(textPrimary, isStrong ? 0.28 : 0.20);

  const [ar, ag, ab] = hexToRgbTuple(rawAccent);
  const accentHover = shiftHexBrightness(rawAccent, effectiveMode === 'dark' ? 16 : -14);

  root.style.setProperty('--dgod-bg-app', bgApp);
  root.style.setProperty('--dgod-bg-sidebar', bgSidebar);
  root.style.setProperty('--dgod-bg-surface', bgSurface);
  root.style.setProperty('--dgod-bg-surface-elevated', bgSurfaceElevated);
  root.style.setProperty('--dgod-text-primary', textPrimary);
  root.style.setProperty('--dgod-text-secondary', textSecondary);
  root.style.setProperty('--dgod-text-muted', textMuted);
  root.style.setProperty('--dgod-border', borderMain);
  root.style.setProperty('--dgod-border-subtle', borderSubtle);
  root.style.setProperty('--dgod-border-strong', borderStrong);
  root.style.setProperty('--dgod-accent', rawAccent);
  root.style.setProperty('--dgod-accent-hover', accentHover);
  root.style.setProperty('--dgod-accent-rgb', `${ar}, ${ag}, ${ab}`);
  root.style.setProperty('--dgod-accent-muted', `rgba(${ar}, ${ag}, ${ab}, 0.16)`);
  root.style.setProperty('--dgod-accent-border', `rgba(${ar}, ${ag}, ${ab}, 0.40)`);
  root.style.setProperty('color-scheme', effectiveMode);
  root.setAttribute('data-theme-preset', settings.themePreset || 'gruvbox-material');
  root.setAttribute('data-theme-mode', effectiveMode);
  root.setAttribute('data-contrast', settings.contrast || 'strong');
  root.classList.remove('theme-dark', 'theme-light', 'theme-windows11');
  root.classList.add(effectiveMode === 'light' ? 'theme-light' : 'theme-windows11');
}

export function getEffectiveThemeBackground(themeId: string): string {
  const theme = TERMINAL_THEMES[themeId] || TERMINAL_THEMES['dgod-dark'];
  return theme.background;
}

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontFamily: "'Fira Code', 'Courier New', monospace",
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 'normal',
  cursorStyle: 'block',
  cursorBlink: true,
  cursorColor: '#E78A4E',
  themeId: 'gruvbox-material',
  scrollback: 5000,
  copyOnSelect: false,
  rightClickPaste: true,
  windowPadding: 8,
  audibleBell: false
};

export const DEFAULT_GENERAL_UI_SETTINGS: GeneralUiSettings = {
  appTheme: 'windows11',
  themeMode: 'dark',
  contrast: 'strong',
  themePreset: 'gruvbox-material',
  customBackground: '#2D2F30',
  customForeground: '#D4BE98',
  customAccent: '#E78A4E',
  conversationSteps: 'default',
  accentColor: 'amber',
  uiDensity: 'comfortable',
  sidebarWidth: 260,
  showStatusBar: true,
  tabStyle: 'rounded',
  enableBlur: true,
  enableAnimations: true,
  confirmCloseSession: true,
  appFontFamily: "'Google Sans', 'Plus Jakarta Sans', 'Segoe UI Variable Text', 'Inter', system-ui, -apple-system, sans-serif",
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
      const parsed = JSON.parse(raw);
      if (parsed.themeId && (!TERMINAL_THEMES[parsed.themeId] || parsed.themeId.startsWith('transparent'))) {
        parsed.themeId = 'gruvbox-material';
      }
      return { ...DEFAULT_TERMINAL_SETTINGS, ...parsed };
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
      const parsed = JSON.parse(raw);
      const merged: GeneralUiSettings = { ...DEFAULT_GENERAL_UI_SETTINGS, ...parsed };
      if (!parsed.themePreset) {
        merged.themePreset = 'gruvbox-material';
        merged.customBackground = '#2D2F30';
        merged.customForeground = '#D4BE98';
        merged.customAccent = '#E78A4E';
        merged.contrast = 'strong';
        merged.themeMode = merged.appTheme === 'light' ? 'light' : 'dark';
      }
      applyAppThemeToDom(merged);
      return merged;
    }
  } catch (e) {
    console.error('Failed to parse UI settings from storage:', e);
  }
  applyAppThemeToDom(DEFAULT_GENERAL_UI_SETTINGS);
  return { ...DEFAULT_GENERAL_UI_SETTINGS };
}

export function saveGeneralUiSettings(settings: GeneralUiSettings): void {
  try {
    applyAppThemeToDom(settings);
    localStorage.setItem(STORAGE_KEY_UI, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('dgodterm:ui-settings-updated', { detail: settings }));
    (window as any).dgodterm?.syncUiSettingsToNative?.(settings);
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
