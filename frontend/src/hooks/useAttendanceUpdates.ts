"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  getStoredChanges,
  clearOldChanges,
  startAttendanceCheck,
  syncDeltaHash,
  type AttendanceUpdate,
} from '@/lib/attendance-background';
import { getSession } from '@/lib/api';
import { isNativePlatform } from '@/lib/capacitor';

const WEB_CHANGES_KEY = 'threshold_web_attendance_changes';

function getStoredWebChanges(): AttendanceUpdate[] {
  try {
    const raw = localStorage.getItem(WEB_CHANGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date: string; changes: AttendanceUpdate[] };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return [];
    return parsed.changes || [];
  } catch {
    return [];
  }
}

function clearOldWebChanges() {
  try {
    const raw = localStorage.getItem(WEB_CHANGES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { date: string };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) {
      localStorage.removeItem(WEB_CHANGES_KEY);
    }
  } catch {
    /* ignore */
  }
}

export interface UseAttendanceUpdatesResult {
  changes: AttendanceUpdate[];
  hasUpdates: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAttendanceUpdates(): UseAttendanceUpdatesResult {
  const [changes, setChanges] = useState<AttendanceUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      if (isNativePlatform()) {
        await clearOldChanges();
        const stored = await getStoredChanges();
        setChanges(stored);
      } else {
        clearOldWebChanges();
        const stored = getStoredWebChanges();
        setChanges(stored);
      }
    } catch {
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Re-check on app resume / tab focus
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        void load();
        void syncDeltaHash();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [load]);

  // Start native background check on mount (no-op on web)
  useEffect(() => {
    const session = getSession();
    if (session?.cookies) {
      void startAttendanceCheck();
    }
  }, []);

  // Sync delta hash whenever attendance data changes
  useEffect(() => {
    const syncOnFocus = () => {
      if (document.visibilityState === 'visible') {
        void syncDeltaHash();
      }
    };
    document.addEventListener('visibilitychange', syncOnFocus);
    return () => document.removeEventListener('visibilitychange', syncOnFocus);
  }, []);

  return {
    changes,
    hasUpdates: changes.length > 0,
    loading,
    refresh: load,
  };
}
