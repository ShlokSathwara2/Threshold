import { registerPlugin } from '@capacitor/core';

interface FileBridgeApi {
  saveToDownloads(options: { filename: string; mime: string; data: string }): Promise<{ path: string }>;
  downloadAndInstall(options: { url: string; filename: string }): Promise<{ status: string }>;
}

export const FileBridge = registerPlugin<FileBridgeApi>('FileBridge');

// Exports every Threshold key from localStorage as one JSON file.
export function collectBackup(): { filename: string; json: string } {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('threshold')) data[k] = localStorage.getItem(k) ?? '';
    }
  } catch {
    /* ignore */
  }
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return {
    filename: `threshold-backup-${stamp}.json`,
    json: JSON.stringify({ app: 'threshold', exportedAt: new Date().toISOString(), data }, null, 2),
  };
}

export function b64(s: string): string {
  try {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
  } catch {
    /* ignore */
  }
  return '';
}

export function b64ToStr(b: string): string {
  try {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b)));
  } catch {
    /* ignore */
  }
  return '';
}

export async function exportBackup(): Promise<string> {
  const { filename, json } = collectBackup();
  try {
    await FileBridge.saveToDownloads({ filename, mime: 'application/json', data: b64(json) });
    return `Saved to Downloads as ${filename}`;
  } catch {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const file = new File([blob], filename, { type: 'application/json' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'Threshold backup' });
        return 'Backup shared';
      }
    } catch {
      /* fall through */
    }
    return 'Backup could not be saved — clipboard copy instead';
  }
}

export interface ImportResult {
  ok: boolean;
  message: string;
}

export function importBackup(text: string): ImportResult {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
      return { ok: false, message: 'Not a Threshold backup file' };
    }
    const data = (parsed as { data: Record<string, string> }).data ?? {};
    let count = 0;
    for (const [k, v] of Object.entries(data)) {
      if (typeof v !== 'string') continue;
      try {
        localStorage.setItem(k, v);
        count++;
      } catch {
        /* skip oversized keys */
      }
    }
    return { ok: true, message: `Restored ${count} settings — reopen the app to apply` };
  } catch {
    return { ok: false, message: 'File could not be read' };
  }
}