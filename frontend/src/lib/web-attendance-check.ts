import { getSession } from './api';
import { userHash } from './user-scope';

const LAST_SEEN_KEY = () => `threshold_attendance_last_seen__${userHash()}`;

interface LastSeenEntry {
  courseCode: string;
  hoursAbsent: number;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showAttendanceNotification(changes: { courseCode: string; type: 'absent' | 'present'; delta: number }[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = 'Attendance Updated';
  const body = changes.map((c) => {
    const symbol = c.type === 'absent' ? '-' : '+';
    return `${c.courseCode}: ${symbol}${c.delta} ${c.type}`;
  }).join(', ');

  try {
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'attendance-update',
    });
  } catch {
    /* notification failed — non-fatal */
  }
}

function getLastSeen(): LastSeenEntry[] {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setLastSeen(entries: LastSeenEntry[]) {
  try {
    localStorage.setItem(LAST_SEEN_KEY(), JSON.stringify(entries));
  } catch {
    /* storage full — ignore */
  }
}

function clearLastSeenIfDayRolledOver() {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY());
    if (!raw) return;
    const stored = JSON.parse(raw) as unknown;
    if (!Array.isArray(stored) || stored.length === 0) return;
    // Check if stored data is from a different day by looking at a timestamp
    // We'll store entries with a date marker at index -1
    const marker = localStorage.getItem(`threshold_attendance_last_seen_date__${userHash()}`);
    const today = new Date().toISOString().slice(0, 10);
    if (marker !== today) {
      localStorage.removeItem(LAST_SEEN_KEY());
      localStorage.setItem(`threshold_attendance_last_seen_date__${userHash()}`, today);
    }
  } catch {
    /* ignore */
  }
}

export interface WebAttendanceChange {
  courseCode: string;
  courseTitle: string;
  type: 'absent' | 'present';
  delta: number;
  timestamp: number;
}

export async function checkAttendanceForChanges(): Promise<WebAttendanceChange[]> {
  const session = getSession();
  if (!session?.cookies) return [];

  clearLastSeenIfDayRolledOver();

  try {
    const { fetchSpAttendance } = await import('./api');
    const res = await fetchSpAttendance();
    if (res.error || !res.attendance) return [];

    const lastSeen = getLastSeen();
    const lastSeenMap = new Map(lastSeen.map((e) => [e.courseCode, e.hoursAbsent]));

    const changes: WebAttendanceChange[] = [];

    for (const att of res.attendance) {
      const prev = lastSeenMap.get(att.courseCode);
      if (prev === undefined) continue; // first time seeing this subject

      const delta = att.hoursAbsent - prev;
      if (delta > 0) {
        changes.push({
          courseCode: att.courseCode,
          courseTitle: att.courseTitle,
          type: 'absent',
          delta,
          timestamp: Date.now(),
        });
      } else if (delta < 0) {
        changes.push({
          courseCode: att.courseCode,
          courseTitle: att.courseTitle,
          type: 'present',
          delta: -delta,
          timestamp: Date.now(),
        });
      }
    }

    // Update last seen
    setLastSeen(res.attendance.map((a) => ({
      courseCode: a.courseCode,
      hoursAbsent: a.hoursAbsent,
    })));

    return changes;
  } catch {
    return [];
  }
}
