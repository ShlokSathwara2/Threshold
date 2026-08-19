import type { TimetableSlot } from './api';
import type { SubjectAttendance } from './attendance-calculator';

export interface DayRecommendation {
  day: string;
  hasClasses: boolean;
  safe: boolean;
  unknown: boolean;
  subjects: {
    courseCode: string;
    courseTitle: string;
    classes: number;
    canSkip: number;
    wouldDropTo: number;
    skippable: boolean;
  }[];
}

export interface Consequence {
  courseCode: string;
  courseTitle: string;
  current: number;
  wouldDropTo: number;
  dropsBelow75: boolean;
}

const DAYS = ['DO-1', 'DO-2', 'DO-3', 'DO-4', 'DO-5'];

export function classesPerDay(schedule: TimetableSlot[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const s of schedule) {
    if (!s.courseCode || !s.day) continue;
    let per = map.get(s.day);
    if (!per) {
      per = new Map();
      map.set(s.day, per);
    }
    per.set(s.courseCode, (per.get(s.courseCode) ?? 0) + 1);
  }
  return map;
}

// For each DO day, decide whether EVERY class that day can be skipped
// without dropping any subject below 75% (optimal bunk planner).
export function computeDayRecommendations(
  schedule: TimetableSlot[],
  subjects: SubjectAttendance[],
  optedOut?: Set<string>
): DayRecommendation[] {
  const byCourse = new Map(subjects.map((s) => [s.courseCode, s] as const));
  const perDay = classesPerDay(
    optedOut?.size ? schedule.filter((s) => !optedOut.has(slotKey(s))) : schedule
  );

  return DAYS.map((day) => {
    const counts = perDay.get(day);
    const classes = counts ? [...counts.entries()] : [];
    if (classes.length === 0) {
      return { day, hasClasses: false, safe: true, unknown: false, subjects: [] };
    }
    const recs = classes.map(([courseCode, n]) => {
      const sub = byCourse.get(courseCode);
      if (!sub) {
        return {
          courseCode,
          courseTitle: courseCode,
          classes: n,
          canSkip: 0,
          wouldDropTo: 0,
          skippable: false,
          unknown: true,
        };
      }
      const wouldDropTo = (sub.present / (sub.total + n)) * 100;
      return {
        courseCode,
        courseTitle: sub.courseTitle,
        classes: n,
        canSkip: Math.min(sub.canBunk, n),
        wouldDropTo,
        skippable: sub.canBunk >= n,
        unknown: false,
      };
    });
    const unknown = recs.some((r) => r.unknown);
    const safe = !unknown && recs.every((r) => r.skippable);
    return { day, hasClasses: true, safe, unknown, subjects: recs };
  });
}

// Skipping a class today → what each subject's percentage drops to.
export function computeConsequences(
  classesToday: TimetableSlot[],
  subjects: SubjectAttendance[],
  optedOut?: Set<string>
): Consequence[] {
  const byCourse = new Map(subjects.map((s) => [s.courseCode, s] as const));
  const seen = new Set<string>();
  const out: Consequence[] = [];
  for (const s of classesToday) {
    if (!s.courseCode || seen.has(s.courseCode)) continue;
    if (optedOut?.has(slotKey(s))) continue;
    seen.add(s.courseCode);
    const sub = byCourse.get(s.courseCode);
    if (!sub || sub.total <= 0) continue;
    const wouldDropTo = (sub.present / (sub.total + 1)) * 100;
    out.push({
      courseCode: s.courseCode,
      courseTitle: sub.courseTitle,
      current: sub.percentage,
      wouldDropTo,
      dropsBelow75: wouldDropTo < 75,
    });
  }
  return out.sort((a, b) => a.wouldDropTo - b.wouldDropTo);
}

export function slotKey(s: TimetableSlot): string {
  return `${s.day}|${s.hour}|${s.courseCode}|${s.slot}`;
}

export function mostMissed(subjects: SubjectAttendance[], limit = 5) {
  return [...subjects]
    .sort((a, b) => b.absent - a.absent)
    .slice(0, limit)
    .map((s) => ({
      courseCode: s.courseCode,
      courseTitle: s.courseTitle,
      absent: s.absent,
      total: s.total,
      percentage: s.percentage,
    }));
}