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

// Resolve TODAY's day order from the academic calendar. Looks the date up
// directly; when today falls outside the planner's range, extrapolates the
// DO-1..DO-5 rotation forward from the last known working day (holidays in
// the known range don't advance the rotation). Returns null when the planner
// is too stale to trust (>45 days behind) or today is a holiday.
export function resolveTodayDayOrder(months: CalendarMonth[]): string | null {
  const todayStr = toDateStr(new Date());
  const all = months
    .flatMap((m) => m.days)
    .filter((d) => !!d.date && DATE_RE.test(d.date))
    .sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0));

  const today = all.find((d) => d.date === todayStr);
  if (today) {
    if (today.isHoliday) return null;
    const m = today.dayOrder?.match(/Day\s*(\d)/i);
    return m && +m[1] >= 1 && +m[1] <= 5 ? `DO-${m[1]}` : null;
  }
  if (all.length === 0) return null;

  let lastDo: number | null = null;
  let lastDate: Date | null = null;
  const nonWorking = new Set<string>();
  for (const d of all) {
    const dt = toDate(d.date!);
    if (!dt) continue;
    if (d.isHoliday) {
      nonWorking.add(d.date!);
      continue;
    }
    const m = d.dayOrder?.match(/Day\s*(\d)/i);
    if (!m) {
      nonWorking.add(d.date!);
      continue;
    }
    if (!lastDate || dt.getTime() > lastDate.getTime()) {
      lastDate = dt;
      lastDo = +m[1];
    }
  }
  if (lastDo === null || !lastDate) return null;

  const todayDt = new Date();
  todayDt.setHours(0, 0, 0, 0);
  const gap = Math.round((todayDt.getTime() - lastDate.getTime()) / 86400000);
  if (gap < 0 || gap > 45) return null;

  let steps = 0;
  for (let i = 1; i <= gap; i++) {
    const ds = toDateStr(new Date(lastDate.getTime() + i * 86400000));
    if (nonWorking.has(ds)) continue;
    steps++;
  }
  return `DO-${((lastDo - 1 + steps) % 5) + 1}`;
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
  attendedBefore: number;
  projectedTotal: number;
  projectedPresent: number;
  projectedAbsent: number;
  projectedPercentage: number;
  projectedMargin: number;
  projectedCanBunk: number;
  projectedMustAttend: number;
  dropsBelow75: boolean;
}

// Projection assumes the student attends EVERY scheduled class between today
// and the leave start (attendedBefore) and misses every class during the
// leave window (missed) — present/absent/total all shift accordingly.
export function projectSubject(subject: SubjectAttendance, missed: number, attendedBefore = 0): LeaveProjection {
  const projectedTotal = subject.total + missed + attendedBefore;
  const projectedPresent = subject.present + attendedBefore;
  const projectedAbsent = subject.absent + missed;
  const projectedPercentage = projectedTotal > 0 ? (projectedPresent / projectedTotal) * 100 : 0;

  let projectedCanBunk = 0;
  let projectedMustAttend = 0;
  if (projectedPercentage >= 75) {
    projectedCanBunk = Math.floor((projectedPresent - 0.75 * projectedTotal) / 0.75);
  } else {
    projectedMustAttend = Math.ceil((0.75 * projectedTotal - projectedPresent) / 0.25);
  }

  return {
    missed,
    attendedBefore,
    projectedTotal,
    projectedPresent,
    projectedAbsent,
    projectedPercentage,
    projectedMargin: projectedPercentage - 75,
    projectedCanBunk,
    projectedMustAttend,
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

export interface LeaveImpact {
  missed: number;
  attendedBefore: number;
}

// Leave-window impact per subject. The user picks leave dates (typically a
// range like 25 Oct – 1 Nov). The projection assumes EVERY scheduled class
// between today and the first leave day is attended (added to present AND
// total), every scheduled class inside the leave window is missed (added to
// absent AND total) — so totals reflect the real end-of-leave picture instead
// of today's stale numbers.
export function computeLeaveImpact(
  scheduleByCourse: DayOrderSchedule,
  lookup: Map<string, string | null>,
  leaveDates: string[],
  todayStr: string
): { from: string | null; to: string | null; perSubject: Map<string, LeaveImpact> } {
  const today = toDate(todayStr);
  const future = leaveDates
    .map(toDate)
    .filter((d): d is Date => !!d && !!today && d.getTime() >= today.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  const perSubject = new Map<string, LeaveImpact>();
  let from: string | null = null;
  let to: string | null = null;

  if (future.length > 0) {
    const leaveStart = future[0];
    const leaveEnd = future[future.length - 1];
    from = toDateStr(leaveStart);
    to = toDateStr(leaveEnd);

    const dates = [...lookup.keys()]
      .map((ds) => ({ ds, date: toDate(ds) }))
      .filter((x): x is { ds: string; date: Date } => !!x.date && !!today && x.date.getTime() >= today.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const [code, per] of scheduleByCourse) {
      const count = (ds: string) => {
        const doName = lookup.get(ds);
        return doName ? (per.get(doName) ?? 0) : 0;
      };
      let missed = 0;
      let attendedBefore = 0;
      for (const { ds, date } of dates) {
        const cls = count(ds);
        if (cls === 0) continue;
        if (date.getTime() < leaveStart.getTime()) attendedBefore += cls;
        else if (date.getTime() <= leaveEnd.getTime()) missed += cls;
        // After the leave ends the semester continues but stays out of the
        // projection — only up to the leave's end is forecast.
      }
      perSubject.set(code, { missed, attendedBefore });
    }
  }

  return { from, to, perSubject };
}