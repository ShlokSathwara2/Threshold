import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

// Version manifest lives next to the APK on GitHub so every installed app
// can check for new releases without any server involvement.
const VERSION_URL = 'https://raw.githubusercontent.com/ShlokSathwara2/Threshold_APK/main/version.json';

export interface UpdateInfo {
  version: string;
  note: string;
  apkUrl: string;
}

export async function getInstalledVersion(): Promise<string> {
  try {
    const info = await App.getInfo();
    return info.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parse(v: string): [number, number, number] {
  const parts = v.trim().split('.');
  return [
    parseInt(parts[0], 10) || 0,
    parseInt(parts[1], 10) || 0,
    parseInt(parts[2], 10) || 0,
  ];
}

export function semverGt(a: string, b: string): boolean {
  const [am, bm] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if (am[i] > bm[i]) return true;
    if (am[i] < bm[i]) return false;
  }
  return false;
}

// Returns update info when a newer version exists AND the user hasn't
// dismissed this exact version before.
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = (await res.json()) as UpdateInfo;
    if (!info?.version || !info?.apkUrl) return null;
    const installed = await getInstalledVersion();
    if (!semverGt(info.version, installed)) return null;
    const dismissed = await Preferences.get({ key: `threshold_update_dismissed_${info.version}` });
    if (dismissed.value === '1') return null;
    return info;
  } catch {
    return null;
  }
}

export async function dismissUpdate(version: string): Promise<void> {
  try {
    await Preferences.set({ key: `threshold_update_dismissed_${version}`, value: '1' });
  } catch {
    /* non-fatal */
  }
}
