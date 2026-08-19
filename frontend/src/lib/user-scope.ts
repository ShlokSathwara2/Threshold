import { getSession } from './api';

// Everything personal is keyed by the LOGGED-IN USER so a shared phone never
// mixes students' data. This is the single source of truth for that scoping.

export function userHash(user?: string): string {
  const u = user ?? getSession()?.user ?? 'anon';
  let h = 5381;
  for (let i = 0; i < u.length; i++) {
    h = ((h << 5) + h + u.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function scopedKey(prefix: string, user?: string): string {
  return `${prefix}__${userHash(user)}`;
}

const SCOPED_PREFIXES = [
  'threshold_cache',
  'threshold_exams_user',
  'threshold_skip_log',
  'threshold_attendance_snapshot',
  'threshold_optional_hours',
  'threshold_subject_registry',
  'threshold_delta_hash',
  'threshold_delta_raw',
  'threshold_sync_log',
  'threshold_notif_prefs',
  'threshold_timetable_cache',
];

// Hard wipe of every user-scoped key on this device — used on explicit logout
// so the next person signing in (e.g. a friend on the same phone) starts with
// zero leftovers: no old timetable, no old exams, no old attendance snapshots.
export function clearAllScopedData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const p of SCOPED_PREFIXES) {
        if (k.startsWith(p)) {
          keys.push(k);
          break;
        }
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// Placeholder identities that every login used to share (hardcoded "student"
// in the session). Real per-login scoping starts once the session carries an
// actual identity (reg number / NetID) instead.
export function isPlaceholderUser(user?: string): boolean {
  return !user || user === 'student' || user === 'anon';
}

// One-time adoption of data saved under the shared "student" identity (the
// pre-fix behaviour where every login mapped to the same hash). Runs only when
// the CURRENT login has no scoped data of its own yet, so on a shared phone
// the first real login takes the old shared data and later logins never see it.
// The 'student' keys are moved (and deleted) — once per device.
let migrationAttempted = false;
export function migrateLegacyIdentity(): void {
  if (migrationAttempted) return;
  migrationAttempted = true;
  try {
    const session = getSession();
    if (!session || isPlaceholderUser(session.user)) return;
    const current = userHash(session.user);
    const legacy = userHash('student');
    if (current === legacy) return;

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const p of SCOPED_PREFIXES) {
        if (!k.startsWith(p + '__')) continue;
        const rest = k.slice(p.length + 2);
        const hash = rest.split('__')[0];
        if (!hash || hash === current) break;
        if (hash === legacy) keys.push(k);
        break;
      }
    }
    if (keys.length === 0) return;

    // Only adopt when this login has no scoped data of its own yet.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const p of SCOPED_PREFIXES) {
        if (!k.startsWith(p + '__')) continue;
        const hash = k.slice(p.length + 2).split('__')[0];
        if (hash === current) return;
        break;
      }
    }

    for (const k of keys) {
      const raw = localStorage.getItem(k);
      const next = k.replace(`__${legacy}`, `__${current}`);
      if (raw !== null) localStorage.setItem(next, raw);
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

// True when at most ONE user has any scoped data on this device. Legacy
// unscoped data (from before per-login storage) may only be adopted in this
// case — on a shared device we never guess which login it belongs to.
export function isSingleUserDevice(): boolean {
  try {
    const seen = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const p of SCOPED_PREFIXES) {
        if (!k.startsWith(p + '__')) continue;
        const rest = k.slice(p.length + 2);
        const hash = rest.split('__')[0];
        if (hash) seen.add(hash);
        break;
      }
    }
    return seen.size <= 1;
  } catch {
    return false;
  }
}

export function scopedStorage<T>(prefix: string): {
  load: () => T | null;
  save: (value: T) => void;
  clear: () => void;
  key: () => string;
} {
  const key = () => scopedKey(prefix);
  const load = (): T | null => {
    try {
      const raw = localStorage.getItem(key());
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  const save = (value: T) => {
    try {
      localStorage.setItem(key(), JSON.stringify(value));
    } catch {
      /* ignore */
    }
  };
  const clear = () => {
    try {
      localStorage.removeItem(key());
    } catch {
      /* ignore */
    }
  };
  return { load, save, clear, key };
}