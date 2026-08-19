"use client";

import { useEffect, useRef } from 'react';

// Renders a glowing 3D helix ribbon from particles. The ribbon is two
// intertwined strands that rotate slowly and undulate like a wave, with
// depth-based size/brightness. Colors sweep violet → magenta → blue.
export default function HelixMark({ progress = 1 }: { progress?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let raf = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#8b5cf6', '#d946ef', '#3b82f6', '#22d3ee'];
    const SEGS = 240;
    const RADIUS = 0.16; // helix radius as fraction of min(W,H)

    const t0 = performance.now();

    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const el = (now - t0) / 1000;
      const R = Math.min(W, H) * RADIUS;
      const turns = 2.6;
      const rev = el * 0.35; // slow rotation
      const wave = Math.sin(el * 0.9) * R * 0.12; // wave undulation

      // Draw the helix as a ribbon of particles along two strands.
      for (let pass = 0; pass < 2; pass++) {
        const phase = pass * Math.PI; // second strand offset by 180°
        for (let i = 0; i <= SEGS; i++) {
          const t = i / SEGS;
          const ang = t * turns * 2 * Math.PI + rev + phase;
          const x = cx + Math.cos(ang) * R;
          const z = Math.sin(ang); // -1..1 → depth
          const y = cy + (t - 0.5) * H * 0.72 + wave * Math.cos(t * Math.PI * 3 + rev);
          const depth = (z + 1) / 2; // 0 far .. 1 near
          const size = 1.2 + depth * 3.4;
          const alpha = 0.25 + depth * 0.75;
          const ci = Math.floor((t * (COLORS.length - 1) + rev) % COLORS.length);
          const c = COLORS[Math.max(0, Math.min(COLORS.length - 1, ci))];
          ctx.globalAlpha = alpha * progress;
          ctx.fillStyle = c;
          ctx.shadowColor = c;
          ctx.shadowBlur = 6 + depth * 14;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [progress]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}