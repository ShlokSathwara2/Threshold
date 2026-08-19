import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

// Version manifest lives next to the APK on GitHub so every installed app
// can check for new releases without any server involvement.
const VERSION_URL = 'https://raw.githubusercontent.com/ShlokSathwara2/Threshold_APK/main/version.json';

export interface UpdateInfo {
  version: string;
  note: string;
  apkUrl: string;
}

// Notification id for "new version available" alerts.
const UPDATE_NOTIF_ID = 5000;

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

// Fire a one-time native notification per version so users learn about an
// update even when the app is in the background. Guarded by Preferences so
// repeated checks never spam the tray.
export async function notifyUpdate(info: UpdateInfo): Promise<void> {
  try {
    const sent = await Preferences.get({ key: `threshold_update_notified_${info.version}` });
    if (sent.value === '1') return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: UPDATE_NOTIF_ID,
          title: 'Threshold update available',
          body: `v${info.version} is out${info.note ? ` — ${info.note}` : ''}. Open the app to update.`,
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_launcher',
        },
      ],
    });
    await Preferences.set({ key: `threshold_update_notified_${info.version}`, value: '1' });
  } catch {
    /* no permission / not on a device — the in-app popup still covers it */
  }
}
