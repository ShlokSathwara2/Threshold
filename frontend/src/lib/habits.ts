import type { TimetableSlot } from './api';
import type { SubjectAttendance } from './attendance-calculator';
import { mostMissed } from './bunk-planner';
import { scopedKey, isSingleUserDevice } from './user-scope';

export interface SkipAttribution {
  date: string;
  dayOrder: string | null;
  courseCode: string;
  count: number;
}

const LEGACY_SNAP_KEY = 'threshold_attendance_snapshot';
const LEGACY_LOG_KEY = 'threshold_skip_log';
const MAX_LOG = 400;

// Per-login keys — habit insights never leak across students on one device.
const SNAP_KEY = () => scopedKey('threshold_attendance_snapshot');
const LOG_KEY = () => scopedKey('threshold_skip_log');

interface Snapshot {
  date: string;
  byCode: Record<string, { absent: number }>;
}

// Adopt legacy unscoped data only on a single-user device.
function adoptLegacy(): void {
  try {
    if (!isSingleUserDevice()) return;
    if (!localStorage.getItem(LOG_KEY()) && localStorage.getItem(LEGACY_LOG_KEY)) {
      localStorage.setItem(LOG_KEY(), localStorage.getItem(LEGACY_LOG_KEY) || '');
      localStorage.removeItem(LEGACY_LOG_KEY);
    }
    if (!localStorage.getItem(SNAP_KEY()) && localStorage.getItem(LEGACY_SNAP_KEY)) {
      localStorage.setItem(SNAP_KEY(), localStorage.getItem(LEGACY_SNAP_KEY) || '');
      localStorage.removeItem(LEGACY_SNAP_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadAttributions(): SkipAttribution[] {
  adoptLegacy();
  try {
    const raw = localStorage.getItem(LOG_KEY());
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is SkipAttribution =>
        !!e && typeof e === 'object' && typeof (e as SkipAttribution).date === 'string'
    );
  } catch {
    return [];
  }
}

// Diffs the current attendance against the last snapshot (once per day).
// When a subject's absences grew, that skip is attributed to the logged day
// order — this is how per-day skipping patterns get built factually.
export function recordAttendanceSnapshot(
  subjects: SubjectAttendance[],
  todayStr: string,
  dayOrder: string | null
): SkipAttribution[] {
  const now: Snapshot = {
    date: todayStr,
    byCode: Object.fromEntries(subjects.map((s) => [s.courseCode, { absent: s.absent }])),
  };
  try {
    const raw = localStorage.getItem(SNAP_KEY());
    const prev: Snapshot | null = raw ? (JSON.parse(raw) as Snapshot) : null;
    if (prev && prev.date === todayStr) return [];
    const attributions: SkipAttribution[] = [];
    if (prev) {
      for (const s of subjects) {
        const before = prev.byCode[s.courseCode]?.absent ?? 0;
        const delta = s.absent - before;
        if (delta > 0) {
          attributions.push({
            date: todayStr,
            dayOrder,
            courseCode: s.courseCode,
            count: delta,
          });
        }
      }
      if (attributions.length > 0) {
        const log = [...attributions, ...loadAttributions()].slice(0, MAX_LOG);
localStorage.setItem(LOG_KEY(), JSON.stringify(log));
      } else if (dayOrder) {
        // Calendar often loads after the snapshot was taken — backfill the
        // day order on any entries logged earlier today.
        const log = loadAttributions();
        let changed = false;
        for (const e of log) {
          if (e.date === todayStr && !e.dayOrder) {
            e.dayOrder = dayOrder;
            changed = true;
          }
        }
        if (changed) localStorage.setItem(LOG_KEY(), JSON.stringify(log));
      }
    }
    localStorage.setItem(SNAP_KEY(), JSON.stringify(now));
    return attributions;
  } catch {
    return [];
  }
}

export interface HabitInsights {
  mostMissed: ReturnType<typeof mostMissed>;
  dayLoad: { day: string; classes: number }[];
  tracked: { dayOrder: string; skips: number }[];
  totalTracked: number;
}

const DAYS = ['DO-1', 'DO-2', 'DO-3', 'DO-4', 'DO-5'];

export function clearSkipLog(): void {
  localStorage.removeItem(LOG_KEY());
  localStorage.removeItem(SNAP_KEY());
}

export function computeHabitInsights(
  subjects: SubjectAttendance[],
  schedule: TimetableSlot[]
): HabitInsights {
  const load = DAYS.map((day) => ({
    day,
    classes: schedule.filter((s) => s.day === day && s.courseCode).length,
  })).filter((d) => d.classes > 0);
  const log = loadAttributions();
  const per = new Map<string, number>();
  for (const a of log) {
    if (!a.dayOrder) continue;
    per.set(a.dayOrder, (per.get(a.dayOrder) ?? 0) + a.count);
  }
  return {
    mostMissed: mostMissed(subjects),
    dayLoad: load.sort((a, b) => b.classes - a.classes),
    tracked: [...per.entries()]
      .map(([dayOrder, skips]) => ({ dayOrder, skips }))
      .sort((a, b) => b.skips - a.skips),
    totalTracked: log.reduce((s, a) => s + a.count, 0),
  };
}