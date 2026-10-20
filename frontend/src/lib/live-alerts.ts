"use client";

// Live alerts — best-effort, on-device change detection for attendance and
// internal marks.
//
// There is no always-on server pushing notifications, so changes are found by
// diffing the latest portal data against the last snapshot this device saw.
// While the app is open we poll every few minutes (and whenever the tab/app
// becomes visible); on Android the background worker does the same while the
// app is closed. Every detected change is also kept in a small "today" feed so
// the dashboard can show what happened.

import {
  fetchSpAttendance,
  fetchSpInternalMarks,
  getSession,
  type Attendance,
  type InternalMark,
} from './api';
import { scopedKey } from './user-scope';
import { isNativePlatform } from './capacitor';
import {
  ensureNotificationChannels,
  showRichNotification,
  THRESHOLD_CHANNEL_ID,
} from './attendance-background';

export type LiveAlertKind =
  | 'marks-new'
  | 'marks-updated'
  | 'attendance-low'
  | 'attendance-absent'
  | 'attendance-present';

export interface LiveAlert {
  id: string;
  kind: LiveAlertKind;
  title: string;
  body: string;
  /** Course code this alert belongs to (when it has one). */
  code?: string;
  at: number;
  href?: string;
}

interface MarksSnapshot {
  [code: string]: { scored: number; max: number; description: string };
}

interface AttendanceSnapshot {
  [code: string]: { conducted: number; absent: number; pct: number };
}

const ALERTS_KEY = () => scopedKey('threshold_live_alerts');
const MARKS_KEY = () => scopedKey('threshold_live_marks_snapshot');
const ATT_KEY = () => scopedKey('threshold_live_att_snapshot');
const LOW_KEY = () => scopedKey('threshold_live_low_attendance');

const LOW_THRESHOLD = 75;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — ignore */
  }
}

// ── Alert feed ──────────────────────────────────────────────────────────────

export function getLiveAlerts(): LiveAlert[] {
  const stored = readJson<{ date: string; alerts: LiveAlert[] }>(ALERTS_KEY(), {
    date: todayKey(),
    alerts: [],
  });
  if (stored.date !== todayKey()) return [];
  return Array.isArray(stored.alerts) ? stored.alerts : [];
}

function saveLiveAlerts(alerts: LiveAlert[]): void {
  writeJson(ALERTS_KEY(), { date: todayKey(), alerts: alerts.slice(-60) });
}

export function clearLiveAlerts(): void {
  saveLiveAlerts([]);
}

function addToFeed(alerts: LiveAlert[]): LiveAlert[] {
  if (alerts.length === 0) return getLiveAlerts();
  const existing = getLiveAlerts();
  const ids = new Set(existing.map((a) => a.id));
  const merged = [...existing, ...alerts.filter((a) => !ids.has(a.id))].sort((a, b) => a.at - b.at);
  saveLiveAlerts(merged);
  return merged;
}

// ── System notification (native + web) ──────────────────────────────────────

async function ensureNativePermission(): Promise<boolean> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    if (status.display === 'denied') return false;
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  } catch {
    return false;
  }
}

async function ensureChannel(): Promise<void> {
  // Native builder creates the shared lively channel (custom chime, vibration,
  // category colours); the Capacitor fallback lives in the same helper so any
  // build can still find the channel.
  await ensureNotificationChannels();
}

/**
 * Show one system notification. Safe no-op if permission was not granted.
 * On Android it goes through the native rich builder — custom layout, chime and
 * vibration — for a consistent, lively Threshold look.
 */
export async function sendSystemNotification(
  title: string,
  body: string,
  kind: LiveAlertKind | 'default' | 'update' = 'default',
): Promise<boolean> {
  if (isNativePlatform()) {
    if (!(await ensureNativePermission())) return false;
    await ensureChannel();

    if (await showRichNotification(title, body, kind)) return true;

    // Fallback: plain Capacitor notification on the same channel.
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2_000_000_000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 600) },
            sound: 'threshold_ping',
            channelId: THRESHOLD_CHANNEL_ID,
            smallIcon: 'ic_launcher_foreground',
            iconColor: '#22C55E',
            largeBody: body,
            summaryText: 'Threshold',
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return false;
    const options: NotificationOptions & { vibrate?: number[] } = {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'threshold-live',
      // Lively on web too: soft buzz + badging where the browser supports it.
      vibrate: [60, 40, 90],
    } as NotificationOptions & { vibrate?: number[] };
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/** Settings → “Send a test notification”. Must be called from a user gesture. */
export async function sendTestNotification(): Promise<boolean> {
  return sendSystemNotification(
    'Threshold alerts are working 🎉',
    'You will be notified when attendance or internal marks change.',
    'update',
  );
}

function notifyCombined(alerts: LiveAlert[]): void {
  if (alerts.length === 0) return;
  const title =
    alerts.length === 1
      ? alerts[0].title
      : `${alerts.length} new updates in Threshold`;
  const body = alerts
    .slice(0, 3)
    .map((a) => (a.code ? `${a.code}: ${a.body}` : a.body))
    .join(' · ');
  // Lead with the most important change so the colour/icon match what matters:
  // low attendance > absent > new marks > updated marks > present.
  const kind: LiveAlertKind =
    alerts.find((a) => a.kind === 'attendance-low')?.kind ??
    alerts.find((a) => a.kind === 'attendance-absent')?.kind ??
    alerts.find((a) => a.kind === 'marks-new')?.kind ??
    alerts.find((a) => a.kind === 'marks-updated')?.kind ??
    alerts[0].kind;
  void sendSystemNotification(title, body, kind);
}

// ── Change detection ────────────────────────────────────────────────────────

function detectAttendance(
  rows: Attendance[],
  lowState: Record<string, boolean>,
): { alerts: LiveAlert[]; snapshot: AttendanceSnapshot; lowState: Record<string, boolean> } {
  const previous = readJson<AttendanceSnapshot | null>(ATT_KEY(), null);
  const snapshot: AttendanceSnapshot = {};
  const nextLow = { ...lowState };
  const alerts: LiveAlert[] = [];
  const now = Date.now();

  for (const row of rows) {
    const code = row.courseCode;
    if (!code) continue;

    const conducted = Number(row.hoursConducted) || 0;
    const absent = Number(row.hoursAbsent) || 0;
    const pct = Number.isFinite(row.attendancePercentage)
      ? Number(row.attendancePercentage)
      : conducted > 0
        ? ((conducted - absent) / conducted) * 100
        : 0;

    snapshot[code] = { conducted, absent, pct };
    const prev = previous?.[code];

    // First run for this subject / this device: learn the baseline silently.
    if (!prev) {
      if (pct < LOW_THRESHOLD) nextLow[code] = true;
      continue;
    }

    const absentDelta = absent - prev.absent;
    const conductedDelta = conducted - prev.conducted;

    if (absentDelta > 0) {
      alerts.push({
        id: `att-absent-${code}-${now}`,
        kind: 'attendance-absent',
        title: 'Attendance updated',
        body: `${absentDelta} class${absentDelta > 1 ? 'es' : ''} marked absent · ${pct.toFixed(1)}%`,
        code,
        at: now,
        href: `/dashboard/attendance?code=${encodeURIComponent(code)}`,
      });
    } else if (absentDelta < 0) {
      alerts.push({
        id: `att-corrected-${code}-${now}`,
        kind: 'attendance-present',
        title: 'Attendance corrected',
        body: `${-absentDelta} absent mark${absentDelta < -1 ? 's' : ''} removed · ${pct.toFixed(1)}%`,
        code,
        at: now,
        href: `/dashboard/attendance?code=${encodeURIComponent(code)}`,
      });
    } else if (conductedDelta > 0) {
      alerts.push({
        id: `att-present-${code}-${now}`,
        kind: 'attendance-present',
        title: 'Attendance updated',
        body: `${conductedDelta} class${conductedDelta > 1 ? 'es' : ''} marked present · ${pct.toFixed(1)}%`,
        code,
        at: now,
        href: `/dashboard/attendance?code=${encodeURIComponent(code)}`,
      });
    }

    // Crossing below 75% — alert once per crossing, not on every poll.
    if (pct < LOW_THRESHOLD && !nextLow[code]) {
      nextLow[code] = true;
      alerts.push({
        id: `att-low-${code}-${now}`,
        kind: 'attendance-low',
        title: 'Attendance below 75%',
        body: `You are at ${pct.toFixed(1)}% — attend the next classes to recover.`,
        code,
        at: now,
        href: `/dashboard/attendance?code=${encodeURIComponent(code)}`,
      });
    } else if (pct >= LOW_THRESHOLD && nextLow[code]) {
      delete nextLow[code];
    }
  }

  return { alerts, snapshot, lowState: nextLow };
}

function detectMarks(rows: InternalMark[]): LiveAlert[] {
  const previous = readJson<MarksSnapshot | null>(MARKS_KEY(), null);
  const snapshot: MarksSnapshot = {};
  const alerts: LiveAlert[] = [];
  const now = Date.now();

  for (const row of rows) {
    if (!row.code) continue;
    const scored = parseFloat(row.scored) || 0;
    const max = parseFloat(row.maxMark) || 0;
    snapshot[row.code] = { scored, max, description: row.description || '' };
    if (max <= 0) continue;

    // No baseline at all: this is the first check after installing the
    // feature — record it without firing a burst of old-marks alerts.
    if (!previous) continue;

    const prev = previous[row.code];
    if (!prev) {
      if (scored > 0) {
        alerts.push({
          id: `marks-new-${row.code}-${now}`,
          kind: 'marks-new',
          title: 'New marks published',
          body: `${scored.toFixed(scored % 1 ? 1 : 0)} / ${max.toFixed(max % 1 ? 1 : 0)}`,
          code: row.code,
          at: now,
          href: '/dashboard/internal-marks',
        });
      }
      continue;
    }

    const changed =
      Math.abs(prev.scored - scored) > 0.001 || Math.abs(prev.max - max) > 0.001;
    if (changed) {
      alerts.push({
        id: `marks-updated-${row.code}-${now}`,
        kind: 'marks-updated',
        title: 'Internal marks updated',
        body: `${prev.scored.toFixed(1)} → ${scored.toFixed(1)} / ${max.toFixed(0)}`,
        code: row.code,
        at: now,
        href: '/dashboard/internal-marks',
      });
    }
  }

  writeJson(MARKS_KEY(), snapshot);
  return alerts;
}

export interface CheckLiveAlertsOptions {
  attendance: boolean;
  marks: boolean;
  /** Show a system notification when something changed. */
  notify: boolean;
}

/**
 * Fetch the latest data, diff it against the last snapshot and persist any
 * changes. Returns only the alerts detected on this run.
 */
export async function checkForLiveAlerts(
  opts: CheckLiveAlertsOptions,
): Promise<LiveAlert[]> {
  const session = getSession();
  if (!session?.cookies) return [];

  const detected: LiveAlert[] = [];

  if (opts.attendance) {
    try {
      const res = await fetchSpAttendance();
      if (!res.error && Array.isArray(res.attendance) && res.attendance.length > 0) {
        const lowState = readJson<Record<string, boolean>>(LOW_KEY(), {});
        const result = detectAttendance(res.attendance, lowState);
        // Only persist after a successful parse, so a failed fetch never
        // rewrites the baseline and hides the next real change.
        writeJson(ATT_KEY(), result.snapshot);
        writeJson(LOW_KEY(), result.lowState);
        detected.push(...result.alerts);
      }
    } catch {
      /* offline / expired session — try again on the next poll */
    }
  }

  if (opts.marks) {
    try {
      const res = await fetchSpInternalMarks();
      const rows = Array.isArray(res.internal_marks) ? res.internal_marks : [];
      if (!res.error && rows.length > 0) {
        detected.push(...detectMarks(rows));
      }
    } catch {
      /* offline / expired session — try again on the next poll */
    }
  }

  if (detected.length === 0) return [];

  addToFeed(detected);
  if (opts.notify) notifyCombined(detected);
  return detected;
}
