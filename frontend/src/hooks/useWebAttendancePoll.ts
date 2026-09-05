"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  checkAttendanceForChanges,
  requestNotificationPermission,
  showAttendanceNotification,
  type WebAttendanceChange,
} from '@/lib/web-attendance-check';
import { isNativePlatform } from '@/lib/capacitor';

const POLL_INTERVAL = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = 'threshold_web_attendance_changes';

function getStoredWebChanges(): WebAttendanceChange[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date: string; changes: WebAttendanceChange[] };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return [];
    return parsed.changes || [];
  } catch {
    return [];
  }
}

function storeWebChanges(changes: WebAttendanceChange[]) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, changes }));
  } catch {
    /* ignore */
  }
}

function clearOldWebChanges() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { date: string };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export interface UseWebAttendancePollResult {
  changes: WebAttendanceChange[];
  hasUpdates: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useWebAttendancePoll(): UseWebAttendancePollResult {
  const [changes, setChanges] = useState<WebAttendanceChange[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    clearOldWebChanges();
    const stored = getStoredWebChanges();
    setChanges(stored);
    setLoading(false);
  }, []);

  const poll = useCallback(async () => {
    // Skip on native — the native worker handles it
    if (isNativePlatform()) return;

    const session = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('threshold_session') || 'null')
      : null;
    if (!session?.cookies) return;

    const detected = await checkAttendanceForChanges();
    if (detected.length > 0) {
      // Merge with existing stored changes
      const existing = getStoredWebChanges();
      const merged = [...existing, ...detected];
      storeWebChanges(merged);
      setChanges(merged);

      // Show browser notification
      showAttendanceNotification(detected);
    }
  }, []);

  // Load stored changes on mount
  useEffect(() => {
    load();
  }, [load]);

  // Initial poll after 30 seconds (give time for initial data load)
  useEffect(() => {
    if (isNativePlatform()) return;
    const timer = window.setTimeout(() => {
      void poll();
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [poll]);

  // Hourly polling while tab is open
  useEffect(() => {
    if (isNativePlatform()) return;
    const interval = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [poll]);

  // Poll on visibility change (user returns to tab)
  useEffect(() => {
    if (isNativePlatform()) return;
    const handler = () => {
      if (document.visibilityState === 'visible') {
        void poll();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [poll]);

  // Request notification permission on mount (after short delay)
  useEffect(() => {
    if (isNativePlatform()) return;
    const timer = window.setTimeout(() => {
      void requestNotificationPermission();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return {
    changes,
    hasUpdates: changes.length > 0,
    loading,
    refresh: load,
  };
}
