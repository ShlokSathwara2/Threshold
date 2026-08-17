import { getSession } from './api';

const PREFIX = 'threshold_cache';

// Stable per-session scope: hashes the SP cookies so different students on
// the same device never see each other's cached data.
function scopeHash(cookies: string): string {
  let h = 5381;
  for (let i = 0; i < cookies.length; i++) {
    h = ((h << 5) + h + cookies.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function scope(): string {
  if (typeof window === 'undefined') return 'anon';
  const cookies = getSession()?.cookies;
  return cookies ? scopeHash(cookies) : 'anon';
}

export function cacheKey(ns: string): string {
  return `${PREFIX}__${scope()}__${ns}`;
}

export interface Cached<T> {
  data: T;
  savedAt: number;
}

export function getCached<T>(ns: string): Cached<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(ns));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.data === undefined) return null;
    return { data: parsed.data as T, savedAt: parsed.savedAt as number };
  } catch {
    return null;
  }
}

export function setCached<T>(ns: string, data: T) {
  try {
    localStorage.setItem(cacheKey(ns), JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function clearCached(ns: string) {
  try {
    localStorage.removeItem(cacheKey(ns));
  } catch {
    /* ignore */
  }
}

// Removes every session-scoped cache entry (called on explicit logout so a
// different user signing in on the same phone starts clean).
export function clearAllCaches() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}