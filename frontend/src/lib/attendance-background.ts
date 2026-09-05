import { registerPlugin } from '@capacitor/core';
import { getSession } from './api';
import { userHash } from './user-scope';

interface AttendanceCheckApi {
  start(options: { cookie: string; apiBase: string; deltaHash: string }): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  updateDeltaHash(options: { deltaHash: string }): Promise<{ updated: boolean }>;
  getChanges(): Promise<{ hasUpdates: boolean; changes: AttendanceUpdate[]; lastCheck: number }>;
  clearOld(): Promise<{ cleared: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
}

export interface AttendanceUpdate {
  courseCode: string;
  courseTitle: string;
  type: 'absent' | 'present';
  delta: number;
  timestamp: number;
}

export const AttendanceCheck = registerPlugin<AttendanceCheckApi>('AttendanceCheck');

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://threshold-1-ly01.onrender.com';

function getDeltaHash(): string {
  try {
    const session = getSession();
    const h = userHash(session?.user);
    return localStorage.getItem(`threshold_delta_hash__${h}__attendance`) || '';
  } catch {
    return '';
  }
}

function isNative(): boolean {
  try {
    // @ts-expect-error Capacitor runtime flag
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export async function startAttendanceCheck(): Promise<void> {
  if (!isNative()) return;
  const session = getSession();
  if (!session?.cookies) return;

  try {
    const deltaHash = getDeltaHash();
    await AttendanceCheck.start({
      cookie: session.cookies,
      apiBase: API_BASE,
      deltaHash,
    });
  } catch (e) {
    console.warn('[AttendanceCheck] start failed:', e);
  }
}

export async function stopAttendanceCheck(): Promise<void> {
  if (!isNative()) return;
  try {
    await AttendanceCheck.stop();
  } catch (e) {
    console.warn('[AttendanceCheck] stop failed:', e);
  }
}

export async function syncDeltaHash(): Promise<void> {
  if (!isNative()) return;
  try {
    const deltaHash = getDeltaHash();
    await AttendanceCheck.updateDeltaHash({ deltaHash });
  } catch {
    /* non-fatal */
  }
}

export async function getStoredChanges(): Promise<AttendanceUpdate[]> {
  if (!isNative()) return [];
  try {
    const result = await AttendanceCheck.getChanges();
    return result.hasUpdates ? result.changes : [];
  } catch {
    return [];
  }
}

export async function clearOldChanges(): Promise<void> {
  if (!isNative()) return;
  try {
    await AttendanceCheck.clearOld();
  } catch {
    /* non-fatal */
  }
}
