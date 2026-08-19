import { LocalNotifications } from '@capacitor/local-notifications';
import type { NotifPrefs } from './theme';
import { nextExamDate, type ExamEntry } from './exams';

export interface NotifSubject {
  courseCode: string;
  courseTitle: string;
  percentage: number;
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

export async function refreshNotifications(
  subjects: NotifSubject[],
  exams: ExamEntry[],
  notif: NotifPrefs
): Promise<void> {
  try {
    await LocalNotifications.cancelAll();
  } catch {
    return; // not on a device / permission missing — nothing to do
  }
  if (!notif.enabled) return;

  const granted = await ensurePerm();
  if (!granted) return;

  const now = new Date();
  const toSchedule: Array<{ id: number; title: string; body: string; at: Date }> = [];

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

  if (toSchedule.length === 0) return;
  try {
    await LocalNotifications.schedule({
      notifications: toSchedule.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_launcher',
      })),
    });
  } catch {
    /* scheduling failure — non-fatal */
  }
}