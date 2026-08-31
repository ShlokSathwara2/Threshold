export type CursorStyle = 'classic' | 'minimal' | 'neon' | 'crosshair' | 'off';
export type ParticleEffect = 'burst' | 'sparkle' | 'ring' | 'none';

export const CURSOR_OPTIONS: { id: CursorStyle; label: string; desc: string }[] = [
  { id: 'classic', label: 'Classic', desc: 'Dot + ring + glow' },
  { id: 'minimal', label: 'Minimal', desc: 'Small dot only' },
  { id: 'neon', label: 'Neon', desc: 'Pulsing glow ring' },
  { id: 'crosshair', label: 'Crosshair', desc: 'Precision cursor' },
  { id: 'off', label: 'Off', desc: 'System cursor' },
];

export const PARTICLE_OPTIONS: { id: ParticleEffect; label: string; desc: string }[] = [
  { id: 'burst', label: 'Burst', desc: '12 particles explode' },
  { id: 'sparkle', label: 'Sparkle', desc: 'Tiny shimmer dots' },
  { id: 'ring', label: 'Ring', desc: 'Expanding color ripple' },
  { id: 'none', label: 'None', desc: 'No click effect' },
];

const STYLE_KEY = 'threshold_cursor_style';
const PARTICLE_KEY = 'threshold_cursor_particles';

export function getCursorStyle(): CursorStyle {
  try {
    const v = localStorage.getItem(STYLE_KEY) as CursorStyle | null;
    return v && CURSOR_OPTIONS.some((o) => o.id === v) ? v : 'classic';
  } catch {
    return 'classic';
  }
}

export function setCursorStyle(id: CursorStyle) {
  try { localStorage.setItem(STYLE_KEY, id); } catch {}
}

export function getCursorParticles(): ParticleEffect {
  try {
    const v = localStorage.getItem(PARTICLE_KEY) as ParticleEffect | null;
    return v && PARTICLE_OPTIONS.some((o) => o.id === v) ? v : 'burst';
  } catch {
    return 'burst';
  }
}

export function setCursorParticles(id: ParticleEffect) {
  try { localStorage.setItem(PARTICLE_KEY, id); } catch {}
}
