export type SoundId = 'off' | 'soft_tap' | 'mechanical' | 'pop' | 'crystal';

export const SOUND_OPTIONS: { id: SoundId; label: string; desc: string }[] = [
  { id: 'mechanical', label: 'Mechanical', desc: 'Tactile keyboard-style click' },
  { id: 'soft_tap', label: 'Soft tap', desc: 'Gentle, subtle touch' },
  { id: 'pop', label: 'Pop', desc: 'Playful bounce' },
  { id: 'crystal', label: 'Crystal', desc: 'Bright, light ding' },
  { id: 'off', label: 'Off', desc: 'No sound' },
];

const KEY = 'threshold_click_sound';

const cache = new Map<SoundId, HTMLAudioElement>();

function audioFor(id: SoundId): HTMLAudioElement | null {
  if (id === 'off') return null;
  let a = cache.get(id);
  if (!a) {
    try {
      a = new Audio(`/sounds/${id}.wav`);
      a.preload = 'auto';
      cache.set(id, a);
    } catch {
      return null;
    }
  }
  return a;
}

export function getSoundPref(): SoundId {
  try {
    const v = localStorage.getItem(KEY) as SoundId | null;
    return v && SOUND_OPTIONS.some((o) => o.id === v) ? v : 'mechanical';
  } catch {
    return 'mechanical';
  }
}

export function setSoundPref(id: SoundId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function playClickSound() {
  const id = getSoundPref();
  const a = audioFor(id);
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {
      /* not allowed yet */
    });
  } catch {
    /* ignore */
  }
}

export function hapticTick(strength = 12) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(strength);
  } catch {
    /* ignore */
  }
}