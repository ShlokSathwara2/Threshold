import { registerPlugin } from '@capacitor/core';
import { isNativePlatform } from './capacitor';

/**
 * One class that will be promoted to an Android 16 Live Update (Samsung Now
 * Bar / lock-screen activity) while it is happening.
 */
export interface LiveClassInfo {
  code: string;
  title: string;
  room?: string;
  slot?: string;
  /** Epoch millis for the start of this class today. */
  start: number;
  /** Epoch millis for the end of this class today. */
  end: number;
  /** Current attendance percentage for this subject (e.g. 78.4). */
  percentage?: number;
  /** Positive = classes you can skip; negative = classes needed for 75%. */
  margin?: number;
}

interface ClassLiveApi {
  sync(options: {
    classes: LiveClassInfo[];
    enabled: boolean;
  }): Promise<{ scheduled: number }>;
  clear(): Promise<void>;
  canPostPromoted(): Promise<{ supported: boolean; allowed: boolean }>;
  openSettings(): Promise<{ opened: boolean }>;
}

export const ClassLive = registerPlugin<ClassLiveApi>('ClassLive');

/** Send today's timeline to the native scheduler. Safe no-op on web. */
export async function syncLiveClasses(
  classes: LiveClassInfo[],
  enabled = true,
): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    await ClassLive.sync({ classes, enabled });
    return true;
  } catch {
    return false;
  }
}

/** Remove the live class card + all pending start/end alarms. */
export async function clearLiveClasses(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await ClassLive.clear();
  } catch {
    /* plugin missing in an older build */
  }
}

/**
 * Whether Android will promote the ongoing class to the status-bar chip /
 * Now Bar. `supported` is false below Android 16.
 */
export async function canPostLiveUpdates(): Promise<{
  supported: boolean;
  allowed: boolean;
}> {
  if (!isNativePlatform()) return { supported: false, allowed: false };
  try {
    return await ClassLive.canPostPromoted();
  } catch {
    return { supported: false, allowed: false };
  }
}

/** Deep-link to the system screen where live updates can be enabled. */
export async function openLiveUpdateSettings(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const res = await ClassLive.openSettings();
    return res.opened;
  } catch {
    return false;
  }
}
