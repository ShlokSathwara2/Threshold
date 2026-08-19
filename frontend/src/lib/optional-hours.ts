import type { TimetableSlot } from './api';
import { scopedKey, isSingleUserDevice } from './user-scope';

// OPT toggles are per-login — one student's optional-hour marks never show up
// for another login on the same device.
const LEGACY_KEY = 'threshold_optional_hours';
const KEY = () => scopedKey('threshold_optional_hours');

export function slotKey(s: TimetableSlot): string {
  return `${s.day}|${s.hour}|${s.courseCode}|${s.slot}`;
}

// Adopt legacy unscoped data only on a single-user device.
function adoptLegacy(): void {
  try {
    if (!isSingleUserDevice()) return;
    if (!localStorage.getItem(KEY()) && localStorage.getItem(LEGACY_KEY)) {
      localStorage.setItem(KEY(), localStorage.getItem(LEGACY_KEY) || '');
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadOptionalHours(): Set<string> {
  adoptLegacy();
  try {
    const raw = localStorage.getItem(KEY());
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((k): k is string => typeof k === 'string'));
  } catch {
    return new Set();
  }
}

function save(keys: Set<string>) {
  try {
    localStorage.setItem(KEY(), JSON.stringify([...keys]));
  } catch {
    /* storage unavailable — toggles just won't persist */
  }
}

export function toggleOptionalHour(key: string): Set<string> {
  const next = loadOptionalHours();
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  save(next);
  return next;
}

export function clearOptionalHours(): void {
  try {
    localStorage.removeItem(KEY());
  } catch {
    /* noop */
  }
}