import type { CalendarMonth, TimetableSlot } from './api';
import type { SubjectAttendance } from './attendance-calculator';

// courseCode → day order ("DO-1"…) → number of classes
export type DayOrderSchedule = Map<string, Map<string, number>>;

export function buildDayOrderSchedule(schedule: TimetableSlot[]): DayOrderSchedule {
  const map: DayOrderSchedule = new Map();
  for (const s of schedule) {
    if (!s.courseCode || !s.day) continue;
    let per = map.get(s.courseCode);
    if (!per) {
      per = new Map();
      map.set(s.courseCode, per);
    }
    per.set(s.day, (per.get(s.day) ?? 0) + 1);
  }
  return map;
}

// date ("dd-mm-yyyy") → day order ("DO-3") or null when no classes (holiday/unknown)
export function buildDayOrderLookup(months: CalendarMonth[]): Map<string, string | null> {
  const lookup = new Map<string, string | null>();
  for (const m of months) {
    for (const d of m.days) {
      if (!d.date) continue;
      if (d.isHoliday === true || /holiday/i.test(d.event || '')) {
        lookup.set(d.date, null);
        continue;
      }
      const match = d.dayOrder?.match(/Day\s*(\d)/i);
      lookup.set(d.date, match ? `DO-${match[1]}` : null);
    }
  }
  return lookup;
}

const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;

export function toDate(dateStr: string): Date | null {
  const m = DATE_RE.exec(dateStr);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

export function toDateStr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// "yyyy-mm-dd" (native <input type="date"> value) → "dd-mm-yyyy"
export function fromInputValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d));
}

export function displayDate(dateStr: string): string {
  const d = toDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function classesOnDayOrder(
  scheduleByCourse: DayOrderSchedule,
  courseCode: string,
  doName: string | null
): number {
  if (!doName) return 0;
  return scheduleByCourse.get(courseCode)?.get(doName) ?? 0;
}

export interface LeaveProjection {
  missed: number;
  projectedTotal: number;
  projectedPresent: number;
  projectedPercentage: number;
  dropsBelow75: boolean;
}

export function projectSubject(subject: SubjectAttendance, missed: number): LeaveProjection {
  const projectedTotal = subject.total + missed;
  const projectedPercentage = projectedTotal > 0 ? (subject.present / projectedTotal) * 100 : 0;
  return {
    missed,
    projectedTotal,
    projectedPresent: subject.present,
    projectedPercentage,
    dropsBelow75: projectedPercentage < 75,
  };
}

export interface ReachPlan {
  hasSchedule: boolean;
  reachable: boolean;
  reachDate: string | null;
  futureClasses: number;
  needed: number;
}

// If the student attends EVERY scheduled class from today on, on which date
// does the subject cross 75%? null when the planner ends before that happens.
export function computeReachPlan(
  subject: SubjectAttendance,
  scheduleByCourse: DayOrderSchedule,
  lookup: Map<string, string | null>,
  fromDate: string
): ReachPlan {
  const per = scheduleByCourse.get(subject.courseCode);
  const hasSchedule = !!per && per.size > 0;
  if (!hasSchedule) return { hasSchedule: false, reachable: false, reachDate: null, futureClasses: 0, needed: subject.mustAttend };

  const from = toDate(fromDate);
  const dates = [...lookup.keys()]
    .filter((d) => {
      const date = toDate(d);
      return date && from && date.getTime() >= from.getTime() && lookup.get(d) !== null;
    })
    .sort((a, b) => (toDate(a)?.getTime() ?? 0) - (toDate(b)?.getTime() ?? 0));

  let count = 0;
  let futureClasses = 0;
  for (const d of dates) {
    const classes = classesOnDayOrder(scheduleByCourse, subject.courseCode, lookup.get(d) ?? null);
    futureClasses += classes;
    count += classes;
    if (count >= subject.mustAttend) {
      return { hasSchedule: true, reachable: true, reachDate: d, futureClasses, needed: subject.mustAttend };
    }
  }
  return { hasSchedule: true, reachable: false, reachDate: null, futureClasses, needed: subject.mustAttend };
}

// Sum classes missed per subject over a list of leave dates (dd-mm-yyyy).
export function computeMissedClasses(
  subjects: SubjectAttendance[],
  scheduleByCourse: DayOrderSchedule,
  lookup: Map<string, string | null>,
  leaveDates: string[],
  todayStr: string
): Map<string, number> {
  const missedMap = new Map<string, number>();
  const today = toDate(todayStr);
  const futureDates = leaveDates.filter((d) => {
    const date = toDate(d);
    return date && today && date.getTime() >= today.getTime();
  });
  for (const subject of subjects) {
    let missed = 0;
    for (const d of futureDates) {
      missed += classesOnDayOrder(scheduleByCourse, subject.courseCode, lookup.get(d) ?? null);
    }
    missedMap.set(subject.courseCode, missed);
  }
  return missedMap;
}