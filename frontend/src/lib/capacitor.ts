import { Capacitor } from '@capacitor/core';

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getPlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

export function isIOS(): boolean {
  return getPlatform() === 'ios';
}
