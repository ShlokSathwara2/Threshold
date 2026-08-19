import { fetchSpExams, saveSpExams, getSession } from './api';
import { scopedKey, isSingleUserDevice } from './user-scope';

export interface ExamEntry {
  id: string;
  subjectCode: string;
  subjectTitle: string;
  dates: string[];
  description?: string;
}

// Exams are keyed by the LOGGED-IN USER (not by cookie, not globally), so
// each person on a shared device gets exactly their own list — and a re-login
// with a fresh cookie keeps the same user's exams.
const STORE_PREFIX = 'threshold_exams_user';

function examKey(): string {
  return scopedKey(STORE_PREFIX);
}

function dirtyKey(): string {
  return `${examKey()}__dirty`;
}

export function loadExams(): ExamEntry[] {
  try {
    const raw = localStorage.getItem(examKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.data)) return parsed.data as ExamEntry[];
    }
  } catch {
    /* ignore */
  }
  const legacy = adoptLegacyExams();
  if (legacy) {
    saveExams(legacy);
    return legacy;
  }
  return [];
}

export function saveExams(entries: ExamEntry[]) {
  try {
    localStorage.setItem(examKey(), JSON.stringify({ data: entries, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

// One-time migration from the old cookie-scoped layout. Only adopted when the
// device holds a single user's data (a private phone) — on a shared device we
// never guess which login the legacy list belongs to.
function adoptLegacyExams(): ExamEntry[] | null {
  try {
    if (!isSingleUserDevice()) return null;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('threshold_cache__') && k.endsWith('__exams')) keys.push(k);
    }
    if (keys.length !== 1) return null;
    const parsed = JSON.parse(localStorage.getItem(keys[0]) || '');
    if (!Array.isArray(parsed?.data) || parsed.data.length === 0) return null;
    const list = parsed.data as ExamEntry[];
    localStorage.removeItem(keys[0]);
    return list;
  } catch {
    return null;
  }
}

function markDirty() {
  try {
    localStorage.setItem(dirtyKey(), '1');
  } catch {
    /* ignore */
  }
}

function clearDirty() {
  try {
    localStorage.removeItem(dirtyKey());
  } catch {
    /* ignore */
  }
}

export function examsDirty(): boolean {
  try {
    return localStorage.getItem(dirtyKey()) === '1';
  } catch {
    return false;
  }
}

async function pushExamsToCloud() {
  const session = getSession();
  if (!session?.user) return;
  try {
    await saveSpExams(session.user, loadExams());
    clearDirty();
  } catch {
    /* offline — dirty flag stays, next launch retries */
  }
}

// Two-way sync with the backend store, keyed by the logged-in user so a
// shared device keeps each login's exams separate.
//  - local edits made while offline push up first (dirty flag)
//  - otherwise the cloud copy wins and replaces local
// Returns the list that should be shown, or null when nothing changed.
export async function syncExamsFromCloud(): Promise<ExamEntry[] | null> {
  const session = getSession();
  if (!session?.user) return null;
  try {
    const cloud = await fetchSpExams(session.user);
    if (examsDirty()) {
      const local = loadExams();
      if (local.length > 0) {
        await saveSpExams(session.user, local);
        clearDirty();
        return local;
      }
      // Local list wiped (fresh login / logout) — never push an empty list
      // over the cloud copy.
      clearDirty();
      if (Array.isArray(cloud) && cloud.length > 0) {
        saveExams(cloud);
        return cloud;
      }
      return null;
    }
    if (Array.isArray(cloud) && cloud.length > 0) {
      saveExams(cloud);
      return cloud;
    }
    const local = loadExams();
    if (local.length > 0) {
      await saveSpExams(session.user, local);
      clearDirty();
      return local;
    }
    return null;
  } catch {
    return null; // offline — keep local data
  }
}

export function addExam(entry: Omit<ExamEntry, 'id'>): ExamEntry[] {
  const list = loadExams();
  const next: ExamEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    dates: [...new Set(entry.dates)].sort(),
  };
  const nextList = [...list, next];
  saveExams(nextList);
  markDirty();
  void pushExamsToCloud();
  return nextList;
}

export function removeExam(id: string): ExamEntry[] {
  const list = loadExams().filter((e) => e.id !== id);
  saveExams(list);
  markDirty();
  void pushExamsToCloud();
  return list;
}

export function parseDate(ds: string): Date {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(date: Date, today: Date): number {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

// Earliest upcoming (incl. today) date for an exam entry, or null when all
// dates are in the past.
export function nextExamDate(entry: ExamEntry, today: Date): Date | null {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const upcoming = entry.dates
    .map(parseDate)
    .filter((d) => d.getTime() >= t.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}

export function examStatus(date: Date, today: Date): 'past' | 'today' | 'upcoming' {
  const diff = daysUntil(date, today);
  return diff < 0 ? 'past' : diff === 0 ? 'today' : 'upcoming';
}

export function formatExamDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}