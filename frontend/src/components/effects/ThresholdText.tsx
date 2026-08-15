"use client";

import { useEffect, useRef, useState } from 'react';

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
};

const mixRgb = (from: {r:number,g:number,b:number}, to: {r:number,g:number,b:number}, amount: number) => ({
  r: Math.round(from.r + (to.r - from.r) * amount),
  g: Math.round(from.g + (to.g - from.g) * amount),
  b: Math.round(from.b + (to.b - from.b) * amount)
});

const rgbToCss = (rgb: {r:number,g:number,b:number}) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface Props {
  text?: string;
  particleSize?: number;
  density?: number;
  color?: string;
  highlightColor?: string;
  scatter?: number;
  gatherDuration?: number;
  stagger?: number;
  trigger?: 'mount' | 'hover' | 'click';
  fontSize?: string;
  fontWeight?: number;
  glow?: boolean;
}

export default function ThresholdText({
  text = 'THRESHOLD',
  particleSize = 2,
  density = 4,
  color = '#ffffff',
  highlightColor = '#8b5cf6',
  scatter = 80,
  gatherDuration = 1800,
  stagger = 400,
  trigger = 'mount',
  fontSize = 'clamp(2.5rem, 10vw, 4rem)',
  fontWeight = 800,
  glow = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Array<{
      x: number; y: number; startX: number; startY: number;
      targetX: number; targetY: number; size: number; color: string;
      seed: number; depth: number; delay: number;
    }> = [];
    let animFrame: number | null = null;
    let gathering = false;
    let gatherStart = 0;
    let width = 0;
    let height = 0;

    const startGather = () => {
      if (!particles.length) return;
      gatherStart = performance.now();
      particles.forEach(p => {
        p.startX = p.x;
        p.startY = p.y;
        p.delay = p.seed * stagger;
      });
      gathering = true;
    };

    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      if (glow) {
        ctx.shadowBlur = particleSize * 3;
        ctx.shadowColor = highlightColor;
      }

      let complete = true;
      particles.forEach(p => {
        let baseX = p.targetX;
        let baseY = p.targetY;
        let progress = 1;

        if (gathering) {
          const local = (now - gatherStart - p.delay) / gatherDuration;
          progress = clamp(local, 0, 1);
          const eased = easeOutCubic(progress);
          baseX = p.startX + (p.targetX - p.startX) * eased;
          baseY = p.startY + (p.targetY - p.startY) * eased;
          if (progress < 1) complete = false;
        } else {
          const driftTime = now * 0.001;
          baseX += Math.sin(driftTime * 0.9 + p.seed * 10) * 0.5 * p.depth;
          baseY += Math.cos(driftTime * 0.75 + p.depth * 10) * 0.5 * p.depth;
        }

        const follow = 0.22;
        p.x += (baseX - p.x) * follow;
        p.y += (baseY - p.y) * follow;

        ctx.globalAlpha = clamp(0.35 + progress * 0.65, 0, 1);
        ctx.fillStyle = p.color;
        if (p.size <= 2.1) {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (gathering && complete) gathering = false;
      animFrame = requestAnimationFrame(render);
    };

    const build = () => {
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const resolvedSize = parseFloat(fontSize) || 48;
      const font = `${fontWeight} ${resolvedSize}px Inter, sans-serif`;

      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.font = font;
      const metrics = offCtx.measureText(text);
      const left = Math.ceil(metrics.actualBoundingBoxLeft || 0);
      const right = Math.ceil(metrics.actualBoundingBoxRight || metrics.width);
      const ascent = Math.ceil(metrics.actualBoundingBoxAscent || resolvedSize * 0.78);
      const descent = Math.ceil(metrics.actualBoundingBoxDescent || resolvedSize * 0.22);
      const pad = Math.max(12, Math.ceil(resolvedSize * 0.08));
      const tw = Math.max(1, left + right);
      const th = Math.max(1, ascent + descent);

      offscreen.width = tw + pad * 2;
      offscreen.height = th + pad * 2;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      offCtx.font = font;
      offCtx.textAlign = 'left';
      offCtx.textBaseline = 'alphabetic';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillText(text, pad - left, pad + ascent);

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const targets: Array<{x:number; y:number; alpha:number}> = [];
      const step = Math.max(2, Math.floor(density));

      for (let y = 0; y < offscreen.height; y += step) {
        for (let x = 0; x < offscreen.width; x += step) {
          const alpha = imageData.data[(y * offscreen.width + x) * 4 + 3];
          if (alpha > 40) {
            targets.push({
              x: width / 2 - offscreen.width / 2 + x,
              y: height / 2 - offscreen.height / 2 + y,
              alpha: alpha / 255
            });
          }
        }
      }

      const maxP = Math.max(600, Math.min(4000, Math.floor((width * height) / 100)));
      const stride = Math.max(1, Math.ceil(targets.length / maxP));
      const baseRgb = hexToRgb(color);
      const hiRgb = hexToRgb(highlightColor);

      particles = targets.filter((_, i) => i % stride === 0).map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
        const blend = baseRgb && hiRgb ? clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1) : 0;
        const pColor = baseRgb && hiRgb ? rgbToCss(mixRgb(baseRgb, hiRgb, blend)) : color;
        const angle = seed * Math.PI * 2;
        const dist = scatter * (0.35 + depth * 0.75);
        const startX = target.x + Math.cos(angle) * dist + (seed - 0.5) * scatter * 0.45;
        const startY = target.y + Math.sin(angle) * dist + (depth - 0.9) * scatter * 0.45;
        return {
          x: startX, y: startY, startX, startY,
          targetX: target.x, targetY: target.y,
          size: Math.max(0.6, particleSize * (0.75 + target.alpha * 0.45)),
          color: pColor, seed, depth, delay: seed * stagger
        };
      });

      startGather();
      if (animFrame === null) animFrame = requestAnimationFrame(render);
    };

    const timer = setTimeout(build, 50);

    const ro = new ResizeObserver(() => {
      if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
      build();
    });
    ro.observe(container);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [text, particleSize, density, color, highlightColor, scatter, gatherDuration, stagger, trigger, fontSize, fontWeight, glow]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
