import { LocalNotifications } from '@capacitor/local-notifications';
import type { NotifPrefs } from './theme';
import { isNativePlatform } from './capacitor';
import { ensureNotificationChannels, THRESHOLD_CHANNEL_ID } from './attendance-background';
import { refreshWebNotifications } from './web-notifications';
import { nextExamDate, type ExamEntry } from './exams';
import { buildDayOrderLookup } from './day-order';
import { loadAttributions } from './habits';
import type { CalendarMonth, TimetableSlot } from './api';
import {
  loadStepClasses,
  loadAptitudeClasses,
  getTodayClasses,
  getUpcomingClasses,
  parseTime,
  DAY_LABELS,
  type ScheduleClassEntry,
  type DayOfWeek,
} from './schedule-classes';

export interface NotifSubject {
  courseCode: string;
  courseTitle: string;
  percentage: number;
  mustAttend: number;
  canBunk: number;
  total: number;
}

export interface NotifMeta {
  slots: TimetableSlot[];
  months: CalendarMonth[];
}

const BRIEF_ID = 1;

let permAsked = false;

async function ensurePerm(): Promise<boolean> {
  try {
    const s = await LocalNotifications.checkPermissions();
    if (s.display === 'granted') return true;
    if (permAsked || s.display === 'denied') return false;
    permAsked = true;
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  } catch {
    return false;
  }
}

// Android 12+ defers exact alarms unless the app holds the "Alarms &
// reminders" permission. Ask for it (best-effort) so class reminders fire at
// the right minute instead of being batched by the OS. No-ops on older
// Android and on the web.
async function ensureExactAlarms(): Promise<void> {
  try {
    const ln = LocalNotifications as unknown as {
      checkExactNotificationSetting?: () => Promise<{ exact_alarm?: string }>;
      changeExactNotificationSetting?: () => Promise<{ exact_alarm?: string }>;
    };
    if (!ln.checkExactNotificationSetting) return;
    const s = await ln.checkExactNotificationSetting();
    if (s?.exact_alarm === 'granted') return;
    await ln.changeExactNotificationSetting?.();
  } catch {
    /* unsupported — non-fatal */
  }
}

function at(hour: number, day: Date): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function nextOccurrence(hour: number): Date {
  const now = new Date();
  const candidate = at(hour, now);
  if (candidate.getTime() <= now.getTime() + 5 * 60000) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return at(hour, tomorrow);
  }
  return candidate;
}

function toDateStr(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// Timetable times arrive as 12-hour strings without AM/PM: hours ≤ 6 are
// afternoon (e.g. "01:25 - 02:15" = 1:25 PM), 12 is midday, 7–11 morning.
function parseClock(t: string | undefined): number | null {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let min = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  if (Math.floor(min / 60) <= 6) min += 12 * 60;
  return min;
}

function slotStart(s: TimetableSlot): number {
  const raw = parseClock((s.time || '').split('-')[0]);
  if (raw !== null) return raw;
  return 480 + (s.hour - 1) * 50;
}

// Canonicalise a day-order label ("Day Order 1", "DO1", "DO-1" → "DO-1")
// so timetable slots and calendar day orders match up.
function normDO(label: string | null | undefined): string | null {
  if (!label) return null;
  const m = label.match(/do[- ]?(\d)/i) || label.match(/day[- ]?order[- ]?(\d)/i);
  if (!m) return null;
  return `DO-${m[1]}`;
}

// Short "what's my margin?" line for a class reminder.
function marginHint(s?: NotifSubject): string {
  if (!s) return 'Open the app to check your attendance margin.';
  if (s.canBunk >= 1) {
    return `Margin: you can skip ${s.canBunk} class${s.canBunk === 1 ? '' : 'es'} and stay above 75%.`;
  }
  if (s.mustAttend > 0) {
    return `Margin: attend — ${s.mustAttend} more class${s.mustAttend === 1 ? '' : 'es'} needed to reach 75%.`;
  }
  return 'Margin: right at the 75% line — attend to be safe.';
}

// Class reminders: 10 minutes before EVERY class over the next 7 days (the day
// order is resolved from the academic calendar). The body carries the class
// name, the time, and the attendance margin so the student knows at a glance
// whether skipping is safe.
async function scheduleClassAlerts(
  subjects: NotifSubject[],
  meta: NotifMeta | undefined,
  now: Date
): Promise<Array<{ id: number; title: string; body: string; at: Date }>> {
  const out: Array<{ id: number; title: string; body: string; at: Date }> = [];
  if (!meta || !meta.slots.length || !meta.months.length) return out;

  const byCourse = new Map(subjects.map((s) => [s.courseCode, s]));
  const lookup = buildDayOrderLookup(meta.months);

  // Day order → course → earliest slot (so a lab that lists twice yields one
  // reminder at its earliest start).
  const byDO = new Map<string, Map<string, TimetableSlot>>();
  for (const s of meta.slots) {
    const key = normDO(s.day);
    if (!key) continue;
    let perCourse = byDO.get(key);
    if (!perCourse) {
      perCourse = new Map();
      byDO.set(key, perCourse);
    }
    const existing = perCourse.get(s.courseCode);
    if (!existing || slotStart(s) < slotStart(existing)) perCourse.set(s.courseCode, s);
  }

  let id = 2000;
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const dateStr = toDateStr(day);
    const doName = normDO(lookup.get(dateStr) ?? null);
    if (!doName) continue;
    const perCourse = byDO.get(doName);
    if (!perCourse) continue;
    for (const slot of perCourse.values()) {
      const startMin = slotStart(slot);
      const trigger = new Date(day);
      trigger.setHours(0, startMin - 10, 0, 0);
      if (trigger.getTime() <= now.getTime() + 5 * 60000) continue;
      const hh = Math.floor(startMin / 60);
      const mm = startMin % 60;
      const h12 = ((hh + 11) % 12) + 1;
      const ap = hh >= 12 ? 'PM' : 'AM';
      const timeStr = `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
      const subj = byCourse.get(slot.courseCode);
      const name = subj?.courseTitle || slot.courseTitle || slot.courseCode;
      const pctStr = subj ? ` · ${subj.percentage.toFixed(1)}%` : '';
      out.push({
        id: id++,
        title: `${name} in 10 min — ${timeStr}`,
        body: `${slot.courseCode} at ${timeStr}${pctStr}. ${marginHint(subj)}`,
        at: trigger,
      });
    }
  }
  return out;
}

// "Bunk window" alert: when today's earliest remaining class is safe to
// skip (canBunk >= 1 keeps attendance >= 75%), tell the student 15 minutes
// before it starts — one alert per day.
async function scheduleBunkAlerts(
  subjects: NotifSubject[],
  meta: NotifMeta | undefined,
  now: Date
): Promise<Array<{ id: number; title: string; body: string; at: Date }>> {
  if (!meta || !meta.slots.length || !meta.months.length) return [];
  const bunkable = subjects.filter((s) => s.canBunk >= 1 && s.percentage > 0);
  if (bunkable.length === 0) return [];
  const lookup = buildDayOrderLookup(meta.months);
  const doName = normDO(lookup.get(toDateStr(now)) ?? null);
  if (!doName) return [];

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const candidates: Array<{ s: NotifSubject; startMin: number; timeStr: string }> = [];
  for (const s of bunkable) {
    for (const slot of meta.slots) {
      if (normDO(slot.day) !== doName || slot.courseCode !== s.courseCode) continue;
      const startMin = slotStart(slot);
      if (startMin <= nowMin + 5) continue;
      const hh = Math.floor(startMin / 60);
      const mm = startMin % 60;
      const h12 = ((hh + 11) % 12) + 1;
      const ap = hh >= 12 ? 'PM' : 'AM';
      candidates.push({ s, startMin, timeStr: `${h12}:${String(mm).padStart(2, '0')} ${ap}` });
    }
  }
  if (candidates.length === 0) return [];
  candidates.sort((a, b) => a.startMin - b.startMin);
  const first = candidates[0];
  const trigger = new Date(now);
  trigger.setHours(0, first.startMin - 15, 0, 0);
  if (trigger.getTime() <= now.getTime() + 5 * 60000) return [];
  return [
    {
      id: 3000,
      title: `Safe to skip ${first.s.courseCode}`,
      body: `${first.timeStr} class today — you have ${first.s.canBunk} class${first.s.canBunk === 1 ? '' : 'es'} of slack. Attendance stays above 75%.`,
      at: trigger,
    },
  ];
}

function parseDateStr(d: string): Date | null {
  const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}

// STEP / Aptitude class reminders: 15 min before each class, scheduled
// for upcoming days (recurring weekly classes — not just today).
function scheduleClassTypeAlerts(
  classes: ScheduleClassEntry[],
  type: 'STEP' | 'Aptitude',
  now: Date,
  startId: number
): Array<{ id: number; title: string; body: string; at: Date }> {
  const out: Array<{ id: number; title: string; body: string; at: Date }> = [];
  const upcoming = getUpcomingClasses(classes, 7); // next 7 days
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let id = startId;

  for (const item of upcoming) {
    const startMin = parseTime(item.startTime);
    const triggerMin = startMin - 15;

    // Calculate the trigger date on the actual class day
    const trigger = new Date(item.date);
    trigger.setHours(0, triggerMin, 0, 0);

    // Skip if trigger is in the past (including today's already-passed classes)
    if (trigger.getTime() <= now.getTime() + 5 * 60000) continue;

    const hh = Math.floor(startMin / 60);
    const mm = startMin % 60;
    const h12 = ((hh + 11) % 12) + 1;
    const ap = hh >= 12 ? 'PM' : 'AM';
    const timeStr = `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
    const dayLabel = DAY_LABELS[item.day];
    const isToday = trigger.toDateString() === now.toDateString();

    out.push({
      id: id++,
      title: `${type} class in 15 min`,
      body: `${item.entry.name} at ${timeStr}${isToday ? '' : ` (${dayLabel})`}`,
      at: trigger,
    });
  }
  return out;
}

// Exam day-before reminder: notify at 7 PM the evening before each exam.
function scheduleExamDayBeforeAlerts(
  exams: ExamEntry[],
  now: Date,
  startId: number
): Array<{ id: number; title: string; body: string; at: Date }> {
  const out: Array<{ id: number; title: string; body: string; at: Date }> = [];
  let id = startId;
  for (const entry of exams) {
    const next = nextExamDate(entry, now);
    if (!next) continue;
    const days = Math.round((next.getTime() - now.getTime()) / 86400000);
    if (days !== 1) continue;
    const trigger = new Date(next);
    trigger.setHours(19, 0, 0, 0);
    if (trigger.getTime() <= now.getTime()) continue;
    out.push({
      id: id++,
      title: `Exam tomorrow: ${entry.subjectTitle}`,
      body: `${entry.subjectCode} — prep tonight, you've got this!`,
      at: trigger,
    });
  }
  return out;
}

// Weekly report card: every Sunday at 8 PM, summarise the week.
async function scheduleWeeklyReport(
  subjects: NotifSubject[],
  meta: NotifMeta | undefined,
  now: Date
): Promise<Array<{ id: number; title: string; body: string; at: Date }>> {
  const active = subjects.filter((s) => s.percentage > 0 && s.total > 0);
  if (active.length === 0) return [];

  const totalClasses = active.reduce((s, x) => s + x.total, 0);
  const weightedPct = active.reduce((s, x) => s + (x.percentage / 100) * x.total, 0) / totalClasses;
  const below = active.filter((s) => s.percentage < 75 && s.percentage > 0).length;

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekMisses = loadAttributions()
    .map((a) => ({ date: parseDateStr(a.date), count: a.count }))
    .filter((x): x is { date: Date; count: number } => !!x.date && x.date.getTime() >= weekStart.getTime())
    .reduce((s, x) => s + x.count, 0);

  let nextWeekClasses = 0;
  if (meta && meta.slots.length && meta.months.length) {
    const lookup = buildDayOrderLookup(meta.months);
    for (let i = 1; i <= 7; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() + i);
      const doName = normDO(lookup.get(toDateStr(day)) ?? null);
      if (!doName) continue;
      nextWeekClasses += meta.slots.filter((sl) => normDO(sl.day) === doName).length;
    }
  }

  const at = new Date(now);
  const daysToSunday = (7 - at.getDay()) % 7;
  at.setDate(at.getDate() + (daysToSunday === 0 ? 7 : daysToSunday));
  at.setHours(20, 0, 0, 0);

  return [
    {
      id: 4000,
      title: 'Weekly report card',
      body: `Attendance ${(weightedPct * 100).toFixed(1)}% overall · ${below} subject${below === 1 ? '' : 's'} below 75% · ${weekMisses} miss${weekMisses === 1 ? '' : 'es'} this week · ${nextWeekClasses} classes next week`,
      at,
    },
  ];
}

export interface ScheduledAlert {
  id: number;
  title: string;
  body: string;
  at: Date;
}

// Pure: every alert the user's prefs call for, at `now`. Shared by the native
// (Android alarm) and web (in-page) schedulers so both produce identical alerts.
export async function buildScheduledAlerts(
  subjects: NotifSubject[],
  exams: ExamEntry[],
  notif: NotifPrefs,
  meta: NotifMeta | undefined,
  now: Date,
): Promise<ScheduledAlert[]> {
  const toSchedule: ScheduledAlert[] = [];

  // ── "Attend this class" alerts for subjects below 75% ──────────────
  if (notif.classAlerts) {
    toSchedule.push(...(await scheduleClassAlerts(subjects, meta, now)));
  }

  // ── "Bunk window" alert: today's earliest safe-to-skip class ───────
  if (notif.bunkAlerts) {
    toSchedule.push(...(await scheduleBunkAlerts(subjects, meta, now)));
  }

  // ── Weekly report card (Sunday 8 PM) ──────────────────────────────
  if (notif.weeklyReport) {
    toSchedule.push(...(await scheduleWeeklyReport(subjects, meta, now)));
  }

  // ── Morning brief (8 AM): at-risk subjects + close exams ──────────
  if (notif.attendanceRisk || notif.examDates) {
    const atRisk = subjects
      .filter((s) => s.percentage < 75 && s.percentage > 0)
      .sort((a, b) => a.percentage - b.percentage);
    const soonExams = exams
      .map((e) => ({ entry: e, next: nextExamDate(e, now) }))
      .filter((x) => x.next && Math.round((x.next.getTime() - now.getTime()) / 86400000) <= 3)
      .sort((a, b) => (a.next!.getTime() - b.next!.getTime()));

    if (atRisk.length > 0 || soonExams.length > 0) {
      const parts: string[] = [];
      if (atRisk.length > 0 && notif.attendanceRisk) {
        const names = atRisk.slice(0, 2).map((s) => s.courseTitle || s.courseCode).join(', ');
        parts.push(`${atRisk.length} subject${atRisk.length > 1 ? 's' : ''} below 75% (${names}${atRisk.length > 2 ? '…' : ''})`);
      }
      if (soonExams.length > 0 && notif.examDates) {
        const e = soonExams[0].entry;
        const d = soonExams[0].next!;
        const days = Math.round((d.getTime() - now.getTime()) / 86400000);
        parts.push(`${e.subjectTitle} exam ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`);
      }
      toSchedule.push({
        id: BRIEF_ID,
        title: 'Threshold brief',
        body: parts.join(' · '),
        at: nextOccurrence(8),
      });
    }
  }

  // ── One-off exam reminders (9 AM on the exam day / the day before) ─
  if (notif.examDates) {
    let rid = 1000;
    for (const entry of exams) {
      const next = nextExamDate(entry, now);
      if (!next) continue;
      const days = Math.round((next.getTime() - now.getTime()) / 86400000);
      if (days < 0 || days > 1) continue;
      const remindAt = at(9, next);
      if (remindAt.getTime() <= now.getTime()) continue;
      toSchedule.push({
        id: rid++,
        title: `Exam ${days === 0 ? 'today' : 'tomorrow'}`,
        body: `${entry.subjectTitle} (${entry.subjectCode})${days === 0 ? ' — good luck!' : ' — all the best!'}`,
        at: remindAt,
      });
    }
  }

  // ── Exam day-before reminder (7 PM the evening before) ───────────
  if (notif.examDayBefore) {
    toSchedule.push(...scheduleExamDayBeforeAlerts(exams, now, 5000));
  }

  // ── STEP class reminders (15 min before) ─────────────────────────
  if (notif.stepClasses) {
    const stepClasses = loadStepClasses();
    toSchedule.push(...scheduleClassTypeAlerts(stepClasses, 'STEP', now, 6000));
  }

  // ── Aptitude class reminders (15 min before) ─────────────────────
  if (notif.aptitudeClasses) {
    const aptClasses = loadAptitudeClasses();
    toSchedule.push(...scheduleClassTypeAlerts(aptClasses, 'Aptitude', now, 7000));
  }

  return toSchedule;
}

export async function refreshNotifications(
  subjects: NotifSubject[],
  exams: ExamEntry[],
  notif: NotifPrefs,
  meta?: NotifMeta
): Promise<void> {
  if (!notif.enabled) return;

  const now = new Date();
  const alerts = await buildScheduledAlerts(subjects, exams, notif, meta, now);

  // Website: browsers can't fire alarms while the tab is closed (that needs
  // the Push API + a server), so we run in-page timers while the site is open
  // and catch up missed alerts on the next visit. Same alert set as native.
  if (!isNativePlatform()) {
    refreshWebNotifications(alerts, now);
    return;
  }

  try {
    // Only clear the reminder IDs this module owns. cancelAll() would also
    // wipe rich alerts that are already sitting in the notification shade.
    const pending = await LocalNotifications.getPending();
    const stale = pending.notifications.filter(
      (n) => n.id === BRIEF_ID || (n.id >= 1000 && n.id < 8000),
    );
    if (stale.length > 0) {
      await LocalNotifications.cancel({
        notifications: stale.map((n) => ({ id: n.id })),
      });
    }
  } catch {
    return; // not on a device / permission missing — nothing to do
  }

  const granted = await ensurePerm();
  if (!granted || alerts.length === 0) return;

  // Android 12+ only fires our timers exactly if it holds the exact-alarm
  // permission; ask best-effort before scheduling.
  await ensureExactAlarms();

  // Every reminder rides the shared lively channel (custom chime + vibration),
  // so class/exam/brief alerts match the live-alert notifications.
  const rich = await ensureNotificationChannels();

  try {
    await LocalNotifications.schedule({
      notifications: alerts.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
        sound: 'threshold_ping',
        smallIcon: 'ic_launcher_foreground',
        iconColor: '#22C55E',
        largeBody: n.body,
        summaryText: 'Threshold',
        ...(rich ? { channelId: THRESHOLD_CHANNEL_ID } : {}),
      })),
    });
  } catch {
    /* scheduling failure — non-fatal */
  }
}