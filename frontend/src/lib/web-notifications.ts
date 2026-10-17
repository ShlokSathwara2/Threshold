"use client";

// Website notifications — best-effort, in-page delivery.
//
// Browsers cannot wake up and fire a local notification while the site is
// closed; that needs the Push API plus a server. So while the site is OPEN we
// arm timers for the next few hours of alerts, and when the student next
// visits we "catch up" any alert that fired in the recent past. A service
// worker is registered (see public/sw.js) so real background push can be
// layered on later without touching this call site.

import type { ScheduledAlert } from './notifications';

const FIRED_KEY = 'threshold_web_notif_fired';
const LOOKAHEAD_MS = 12 * 60 * 60 * 1000; // arm timers for the next 12 hours
const CATCHUP_MS = 3 * 60 * 60 * 1000; // re-show alerts missed in the last 3h

let timers: number[] = [];
let swRegistered = false;

export function webNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Request permission. Must be called from a user gesture on most browsers. */
export async function requestWebNotifPermission(): Promise<boolean> {
  if (!webNotificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

function firedKeys(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveFired(set: Set<string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-400)));
  } catch {
    /* ignore */
  }
}

function keyOf(a: ScheduledAlert): string {
  return `${a.id}@${a.at.toISOString()}`;
}

function show(a: ScheduledAlert, missed = false): void {
  try {
    if (!webNotificationsSupported() || Notification.permission !== 'granted') return;
    const n = new Notification(missed ? `⏰ ${a.title}` : a.title, {
      body: a.body,
      tag: keyOf(a), // same tag collapses duplicates
      icon: '/favicon.ico',
    });
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* some browsers throw when constructing outside a SW — non-fatal */
  }
}

/** Register the (push-ready) service worker once per session. */
export function registerWebPushWorker(): void {
  if (swRegistered) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  swRegistered = true;
  void navigator.serviceWorker.register('/sw.js').catch(() => {
    swRegistered = false; // allow a retry on the next visit
  });
}

/**
 * Arm in-page timers for upcoming alerts and immediately show any alert that
 * was missed since the last visit. Called on every dashboard load, so timers
 * are re-armed after a reload while future alerts keep firing.
 */
export function refreshWebNotifications(alerts: ScheduledAlert[], now: Date): void {
  if (!webNotificationsSupported() || Notification.permission !== 'granted') return;

  registerWebPushWorker();

  timers.forEach((t) => window.clearTimeout(t));
  timers = [];

  const fired = firedKeys();

  for (const a of alerts) {
    const key = keyOf(a);
    if (fired.has(key)) continue;

    const delta = a.at.getTime() - now.getTime();

    if (delta <= 0 && now.getTime() - a.at.getTime() <= CATCHUP_MS) {
      show(a, true); // missed while the site was closed — catch up now
      fired.add(key);
      continue;
    }

    if (delta > 0 && delta <= LOOKAHEAD_MS) {
      const t = window.setTimeout(() => {
        show(a);
        const f = firedKeys();
        f.add(key);
        saveFired(f);
      }, delta);
      timers.push(t);
    }
  }

  saveFired(fired);
}
