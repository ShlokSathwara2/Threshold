"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkForLiveAlerts,
  clearLiveAlerts,
  getLiveAlerts,
  type LiveAlert,
} from '@/lib/live-alerts';
import { getSession } from '@/lib/api';
import type { NotifPrefs } from '@/lib/theme';

/** Foreground poll cadence. The Android worker covers the app-closed case. */
const POLL_INTERVAL = 10 * 60 * 1000;

export interface UseLiveAlertsResult {
  alerts: LiveAlert[];
  refresh: () => Promise<void>;
  clear: () => void;
}

/**
 * Keeps the dashboard's live-alerts feed current while the app/tab is open.
 * Alerts are recorded even if system notifications are muted, so the in-app
 * feed never loses an update the student chose not to be pinged about.
 */
export function useLiveAlerts(notif: NotifPrefs): UseLiveAlertsResult {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const running = useRef(false);

  useEffect(() => {
    setAlerts(getLiveAlerts());
  }, []);

  const refresh = useCallback(async () => {
    if (running.current) return;
    if (!getSession()?.cookies) return;
    running.current = true;
    try {
      const fresh = await checkForLiveAlerts({
        attendance: notif.attendanceUpdates,
        marks: notif.marksUpdates,
        notify: notif.enabled,
      });
      if (fresh.length > 0) setAlerts(getLiveAlerts());
    } finally {
      running.current = false;
    }
  }, [notif.enabled, notif.attendanceUpdates, notif.marksUpdates]);

  useEffect(() => {
    if (!getSession()?.cookies) return;

    // Small delay so the dashboard's own data fetch finishes first.
    const first = window.setTimeout(() => void refresh(), 20_000);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const clear = useCallback(() => {
    clearLiveAlerts();
    setAlerts([]);
  }, []);

  return { alerts, refresh, clear };
}
