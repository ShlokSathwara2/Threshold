"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { scopedKey, isSingleUserDevice } from './user-scope';

export interface ThemePalette {
  id: string;
  name: string;
  desc: string;
  swatch: [string, string, string];
  isLight: boolean;
  bg: string;
  bgSoft: string;
  surface: string;
  surfaceSoft: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentDim: string;
  accentText: string;
  text: string;
  textDim: string;
  textFaint: string;
  headerBg: string;
  glow: string;
}

export const THEMES: ThemePalette[] = [
  {
    id: 'dark-glass',
    name: 'Dark Glass',
    desc: 'The classic — frosted dark panels, violet accent',
    swatch: ['#09090f', '#8b5cf6', '#1a1a2e'],
    isLight: false,
    bg: '#09090f',
    bgSoft: '#0d0d1c',
    surface: 'rgba(255,255,255,0.03)',
    surfaceSoft: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    accent: '#8b5cf6',
    accentDim: 'rgba(139,92,246,0.15)',
    accentText: '#c4b5fd',
    text: '#ffffff',
    textDim: 'rgba(255,255,255,0.55)',
    textFaint: 'rgba(255,255,255,0.35)',
    headerBg: 'rgba(9,9,15,0.85)',
    glow: 'rgba(139,92,246,0.25)',
  },
  {
    id: 'oled',
    name: 'OLED Black',
    desc: 'Pure black, maximum contrast, cyan accent',
    swatch: ['#000000', '#22d3ee', '#111827'],
    isLight: false,
    bg: '#000000',
    bgSoft: '#050508',
    surface: 'rgba(255,255,255,0.04)',
    surfaceSoft: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.2)',
    accent: '#22d3ee',
    accentDim: 'rgba(34,211,238,0.15)',
    accentText: '#67e8f9',
    text: '#ffffff',
    textDim: 'rgba(255,255,255,0.6)',
    textFaint: 'rgba(255,255,255,0.4)',
    headerBg: 'rgba(0,0,0,0.9)',
    glow: 'rgba(34,211,238,0.25)',
  },
  {
    id: 'amber',
    name: 'Amber Ember',
    desc: 'Warm dark panels, amber accent',
    swatch: ['#120d06', '#f59e0b', '#2a1f10'],
    isLight: false,
    bg: '#120d06',
    bgSoft: '#1a1309',
    surface: 'rgba(255,255,255,0.03)',
    surfaceSoft: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    accent: '#f59e0b',
    accentDim: 'rgba(245,158,11,0.15)',
    accentText: '#fcd34d',
    text: '#fff7ed',
    textDim: 'rgba(255,247,237,0.6)',
    textFaint: 'rgba(255,247,237,0.4)',
    headerBg: 'rgba(18,13,6,0.88)',
    glow: 'rgba(245,158,11,0.25)',
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    desc: 'Neon night — magenta & lime electric accents',
    swatch: ['#0a0118', '#e879f9', '#a3e635'],
    isLight: false,
    bg: '#0a0118',
    bgSoft: '#120a22',
    surface: 'rgba(255,255,255,0.04)',
    surfaceSoft: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.09)',
    borderStrong: 'rgba(255,255,255,0.18)',
    accent: '#e879f9',
    accentDim: 'rgba(232,121,249,0.15)',
    accentText: '#f0abfc',
    text: '#ffffff',
    textDim: 'rgba(255,255,255,0.6)',
    textFaint: 'rgba(255,255,255,0.4)',
    headerBg: 'rgba(10,1,24,0.88)',
    glow: 'rgba(232,121,249,0.3)',
  },
  {
    id: 'light',
    name: 'Light',
    desc: 'Bright and airy — light panels, indigo accent',
    swatch: ['#f4f4f8', '#6d28d9', '#ffffff'],
    isLight: true,
    bg: '#f4f4f8',
    bgSoft: '#ececf3',
    surface: 'rgba(0,0,0,0.03)',
    surfaceSoft: 'rgba(0,0,0,0.05)',
    border: 'rgba(0,0,0,0.1)',
    borderStrong: 'rgba(0,0,0,0.18)',
    accent: '#6d28d9',
    accentDim: 'rgba(109,40,217,0.12)',
    accentText: '#6d28d9',
    text: '#131318',
    textDim: 'rgba(19,19,24,0.6)',
    textFaint: 'rgba(19,19,24,0.4)',
    headerBg: 'rgba(244,244,248,0.9)',
    glow: 'rgba(109,40,217,0.18)',
  },
];

export interface NotifPrefs {
  enabled: boolean;
  attendanceRisk: boolean;
  examDates: boolean;
  holidays: boolean;
  classAlerts: boolean;
  bunkAlerts: boolean;
  weeklyReport: boolean;
}

export const DEFAULT_NOTIF: NotifPrefs = {
  enabled: false,
  attendanceRisk: false,
  examDates: false,
  holidays: false,
  classAlerts: false,
  bunkAlerts: false,
  weeklyReport: false,
};

const THEME_KEY = 'threshold_theme';
// Notification preferences are per-login: one student's alert toggles never
// bleed into another login on the same phone.
const LEGACY_NOTIF_KEY = 'threshold_notif_prefs';
const NOTIF_KEY = () => scopedKey('threshold_notif_prefs');

function loadNotifPrefs(): NotifPrefs {
  try {
    let raw = localStorage.getItem(NOTIF_KEY());
    if (!raw) {
      // Adopt legacy device-wide prefs only on a single-user device.
      if (!isSingleUserDevice()) return DEFAULT_NOTIF;
      raw = localStorage.getItem(LEGACY_NOTIF_KEY);
      if (raw) {
        localStorage.setItem(NOTIF_KEY(), raw);
        localStorage.removeItem(LEGACY_NOTIF_KEY);
      }
    }
    if (!raw) return DEFAULT_NOTIF;
    return { ...DEFAULT_NOTIF, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF;
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

export function hexToRgb(hex: string): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '139,92,246';
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

// Overlay text color that adapts to light/dark so hardcoded white-alpha
// strings don't disappear on light backgrounds.
export function overlay(theme: ThemePalette, alpha: number): string {
  return theme.isLight ? `rgba(19,19,24,${alpha})` : `rgba(255,255,255,${alpha})`;
}

// Overlay surface/border color (black-alpha in light mode, white-alpha in dark).
export function overlayBg(theme: ThemePalette, alpha: number): string {
  return theme.isLight ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
}

interface ThemeContextValue {
  theme: ThemePalette;
  setTheme: (id: string) => void;
  notif: NotifPrefs;
  setNotif: (p: Partial<NotifPrefs>) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[0],
  setTheme: () => {},
  notif: DEFAULT_NOTIF,
  setNotif: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>('dark-glass');
  const [notif, setNotifState] = useState<NotifPrefs>(DEFAULT_NOTIF);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && THEMES.some((t) => t.id === saved)) setThemeId(saved);
    } catch { /* ignore */ }
    setNotifState(loadNotifPrefs());
  }, []);

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme.id); } catch { /* ignore */ }
    const root = document.documentElement;
    root.style.background = theme.bg;
    root.style.colorScheme = theme.isLight ? 'light' : 'dark';
    root.style.setProperty('--threshold-bg', theme.bg);
    root.style.setProperty('--threshold-bg-soft', theme.bgSoft);
    root.style.setProperty('--threshold-surface', theme.surface);
    root.style.setProperty('--threshold-surface-soft', theme.surfaceSoft);
    root.style.setProperty('--threshold-border', theme.border);
    root.style.setProperty('--threshold-border-strong', theme.borderStrong);
    root.style.setProperty('--threshold-accent', theme.accent);
    root.style.setProperty('--threshold-accent-rgb', hexToRgb(theme.accent));
    root.style.setProperty('--threshold-accent-dim', theme.accentDim);
    root.style.setProperty('--threshold-accent-text', theme.accentText);
    root.style.setProperty('--threshold-text', theme.text);
    root.style.setProperty('--threshold-text-dim', theme.textDim);
    root.style.setProperty('--threshold-text-faint', theme.textFaint);
    root.style.setProperty('--threshold-header-bg', theme.headerBg);
    root.style.setProperty('--threshold-glow', theme.glow);
  }, [theme]);

  const setTheme = useCallback((id: string) => setThemeId(id), []);
  const setNotif = useCallback((p: Partial<NotifPrefs>) => {
    setNotifState((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem(NOTIF_KEY(), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, notif, setNotif }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}