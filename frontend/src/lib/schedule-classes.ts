import { getSession, type CloudScheduleClass } from './api';
import { scopedKey } from './user-scope';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAY_LABELS: Record<DayOfWeek, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

export const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface ClassSchedule {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface ScheduleClassEntry {
  id: string;
  name: string;
  schedule: ClassSchedule[];
}

// ── Generic CRUD (works for both STEP and Aptitude) ──────────────

function createStore(prefix: string) {
  const key = () => scopedKey(prefix);
  const dirtyKey = () => `${key()}__dirty`;

  function load(): ScheduleClassEntry[] {
    try {
      const raw = localStorage.getItem(key());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.data)) return parsed.data as ScheduleClassEntry[];
      }
    } catch { /* ignore */ }
    return [];
  }

  function save(entries: ScheduleClassEntry[]) {
    try {
      localStorage.setItem(key(), JSON.stringify({ data: entries, savedAt: Date.now() }));
    } catch { /* ignore */ }
  }

  function markDirty() {
    try { localStorage.setItem(dirtyKey(), '1'); } catch { /* ignore */ }
  }

  function clearDirty() {
    try { localStorage.removeItem(dirtyKey()); } catch { /* ignore */ }
  }

  function isDirty(): boolean {
    try { return localStorage.getItem(dirtyKey()) === '1'; } catch { return false; }
  }

  return { load, save, markDirty, clearDirty, isDirty, dirtyKey };
}

// ── STEP ─────────────────────────────────────────────────────────

const stepStore = createStore('threshold_step_classes');

export function loadStepClasses(): ScheduleClassEntry[] {
  return stepStore.load();
}

export function saveStepClasses(entries: ScheduleClassEntry[]) {
  stepStore.save(entries);
}

export function addStepClass(entry: Omit<ScheduleClassEntry, 'id'>): ScheduleClassEntry[] {
  const list = stepStore.load();
  const next: ScheduleClassEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  };
  const nextList = [...list, next];
  stepStore.save(nextList);
  stepStore.markDirty();
  void pushToCloud('step', nextList);
  return nextList;
}

export function removeStepClass(id: string): ScheduleClassEntry[] {
  const list = stepStore.load().filter((e) => e.id !== id);
  stepStore.save(list);
  stepStore.markDirty();
  void pushToCloud('step', list);
  return list;
}

export function updateStepClass(id: string, updates: Partial<Omit<ScheduleClassEntry, 'id'>>): ScheduleClassEntry[] {
  const list = stepStore.load().map((e) => e.id === id ? { ...e, ...updates } : e);
  stepStore.save(list);
  stepStore.markDirty();
  void pushToCloud('step', list);
  return list;
}

// ── Aptitude ─────────────────────────────────────────────────────

const aptitudeStore = createStore('threshold_aptitude_classes');

export function loadAptitudeClasses(): ScheduleClassEntry[] {
  return aptitudeStore.load();
}

export function saveAptitudeClasses(entries: ScheduleClassEntry[]) {
  aptitudeStore.save(entries);
}

export function addAptitudeClass(entry: Omit<ScheduleClassEntry, 'id'>): ScheduleClassEntry[] {
  const list = aptitudeStore.load();
  const next: ScheduleClassEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  };
  const nextList = [...list, next];
  aptitudeStore.save(nextList);
  aptitudeStore.markDirty();
  void pushToCloud('aptitude', nextList);
  return nextList;
}

export function removeAptitudeClass(id: string): ScheduleClassEntry[] {
  const list = aptitudeStore.load().filter((e) => e.id !== id);
  aptitudeStore.save(list);
  aptitudeStore.markDirty();
  void pushToCloud('aptitude', list);
  return list;
}

export function updateAptitudeClass(id: string, updates: Partial<Omit<ScheduleClassEntry, 'id'>>): ScheduleClassEntry[] {
  const list = aptitudeStore.load().map((e) => e.id === id ? { ...e, ...updates } : e);
  aptitudeStore.save(list);
  aptitudeStore.markDirty();
  void pushToCloud('aptitude', list);
  return list;
}

// ── Cloud Sync ───────────────────────────────────────────────────

type ClassType = 'step' | 'aptitude';

// Cast cloud data (string day) to typed local format
function castCloud(raw: CloudScheduleClass[]): ScheduleClassEntry[] {
  return raw.map((c) => ({
    ...c,
    schedule: c.schedule.map((s) => ({
      ...s,
      day: s.day as DayOfWeek,
    })),
  }));
}

async function pushToCloud(type: ClassType, entries: ScheduleClassEntry[]) {
  const session = getSession();
  if (!session?.user) return;
  try {
    const { saveSpStepClasses, saveSpAptitudeClasses } = await import('./api');
    if (type === 'step') {
      await saveSpStepClasses(session.user, entries);
    } else {
      await saveSpAptitudeClasses(session.user, entries);
    }
    const store = type === 'step' ? stepStore : aptitudeStore;
    store.clearDirty();
  } catch { /* offline — dirty flag stays */ }
}

export async function syncStepFromCloud(): Promise<ScheduleClassEntry[] | null> {
  const session = getSession();
  if (!session?.user) return null;
  try {
    const { fetchSpStepClasses, saveSpStepClasses } = await import('./api');
    const cloud = await fetchSpStepClasses(session.user);
    if (stepStore.isDirty()) {
      const local = stepStore.load();
      if (local.length > 0) {
        await saveSpStepClasses(session.user, local);
        stepStore.clearDirty();
        return local;
      }
      stepStore.clearDirty();
      const typed = castCloud(cloud);
      if (typed.length > 0) {
        stepStore.save(typed);
        return typed;
      }
      return null;
    }
    const typed = castCloud(cloud);
    if (typed.length > 0) {
      stepStore.save(typed);
      return typed;
    }
    const local = stepStore.load();
    if (local.length > 0) {
      await saveSpStepClasses(session.user, local);
      stepStore.clearDirty();
      return local;
    }
    return null;
  } catch { return null; }
}

export async function syncAptitudeFromCloud(): Promise<ScheduleClassEntry[] | null> {
  const session = getSession();
  if (!session?.user) return null;
  try {
    const { fetchSpAptitudeClasses, saveSpAptitudeClasses } = await import('./api');
    const cloud = await fetchSpAptitudeClasses(session.user);
    if (aptitudeStore.isDirty()) {
      const local = aptitudeStore.load();
      if (local.length > 0) {
        await saveSpAptitudeClasses(session.user, local);
        aptitudeStore.clearDirty();
        return local;
      }
      aptitudeStore.clearDirty();
      const typed = castCloud(cloud);
      if (typed.length > 0) {
        aptitudeStore.save(typed);
        return typed;
      }
      return null;
    }
    const typed = castCloud(cloud);
    if (typed.length > 0) {
      aptitudeStore.save(typed);
      return typed;
    }
    const local = aptitudeStore.load();
    if (local.length > 0) {
      await saveSpAptitudeClasses(session.user, local);
      aptitudeStore.clearDirty();
      return local;
    }
    return null;
  } catch { return null; }
}

// ── Helpers ──────────────────────────────────────────────────────

export function getTodayClasses(entries: ScheduleClassEntry[]): ScheduleClassEntry[] {
  const dayNames: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = dayNames[new Date().getDay()];
  return entries.filter((e) => e.schedule.some((s) => s.day === today));
}

// Get classes scheduled on a specific day-of-week (recurring weekly).
export function getClassesForDay(entries: ScheduleClassEntry[], day: DayOfWeek): ScheduleClassEntry[] {
  return entries.filter((e) => e.schedule.some((s) => s.day === day));
}

// Get all upcoming classes from now up to `daysAhead` (inclusive of today).
// Returns entries with their relevant schedule slots for each matching day.
export function getUpcomingClasses(
  entries: ScheduleClassEntry[],
  daysAhead: number = 7
): Array<{ entry: ScheduleClassEntry; day: DayOfWeek; startTime: string; endTime: string; date: Date }> {
  const dayNames: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const result: Array<{ entry: ScheduleClassEntry; day: DayOfWeek; startTime: string; endTime: string; date: Date }> = [];
  const now = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dow = dayNames[d.getDay()];
    for (const entry of entries) {
      for (const s of entry.schedule) {
        if (s.day === dow) {
          result.push({ entry, day: dow, startTime: s.startTime, endTime: s.endTime, date: d });
        }
      }
    }
  }

  result.sort((a, b) => {
    const dayDiff = a.date.getTime() - b.date.getTime();
    if (dayDiff !== 0) return dayDiff;
    return parseTime(a.startTime) - parseTime(b.startTime);
  });

  return result;
}

export function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
