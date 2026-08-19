"use client";

import { useEffect } from 'react';
import { playClickSound, hapticTick } from '@/lib/sounds';

const INTERACTIVE =
  'button, a, [role="button"], [role="tab"], label, select, input[type="checkbox"], input[type="radio"], input[type="range"], summary, [onclick], [data-click]';

export default function ClickSound() {
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0 && e.type === 'pointerdown') return;
      const t = e.target as Element | null;
      if (!t || typeof t.closest !== 'function') return;
      if (!t.closest(INTERACTIVE)) return;
      playClickSound();
      hapticTick();
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, []);

  return null;
}