import { registerPlugin } from '@capacitor/core';

export interface BiometricLockPluginApi {
  isAvailable(): Promise<{ available: boolean; enrolled: boolean; code: number }>;
  authenticate(options?: { reason?: string }): Promise<void>;
}

export const BiometricLock = registerPlugin<BiometricLockPluginApi>('BiometricLock');

const KEY = 'threshold_applock';

export function appLockEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setAppLockEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}