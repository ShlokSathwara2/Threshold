"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

const COLORS = [
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#3b82f6', // blue
  '#14b8a6', // teal
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  element: HTMLDivElement;
}

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const particleContainerRef = useRef<HTMLDivElement>(null);
  const colorIndexRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const particlesRef = useRef<Particle[]>([]);

  const spawnParticles = useCallback((x: number, y: number, color: string) => {
    const container = particleContainerRef.current;
    if (!container) return;

    const count = 12;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 3;
      const size = 2 + Math.random() * 4;

      el.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        pointer-events: none;
        z-index: 10002;
        box-shadow: 0 0 ${size * 2}px ${color};
      `;
      container.appendChild(el);

      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.4,
        size,
        color,
        element: el,
      });
    }
  }, []);

  useEffect(() => {
    let mouseX = 0, mouseY = 0;
    let dotX = 0, dotY = 0;
    let ringX = 0, ringY = 0;
    let glowX = 0, glowY = 0;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) setVisible(true);
    };

    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    const onClick = (e: MouseEvent) => {
      colorIndexRef.current = (colorIndexRef.current + 1) % COLORS.length;
      const newColor = COLORS[colorIndexRef.current];
      setCurrentColor(newColor);
      spawnParticles(e.clientX, e.clientY, newColor);
    };

    const onDown = () => setPressing(true);
    const onUp = () => setPressing(false);

    const checkHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.closest('button, a, [data-cursor="pointer"], input, textarea, [role="button"]');
      setHovering(!!isInteractive);
    };

    const animate = () => {
      const dotSpeed = 0.25;
      const ringSpeed = 0.12;
      const glowSpeed = 0.06;

      dotX += (mouseX - dotX) * dotSpeed;
      dotY += (mouseY - dotY) * dotSpeed;
      ringX += (mouseX - ringX) * ringSpeed;
      ringY += (mouseY - ringY) * ringSpeed;
      glowX += (mouseX - glowX) * glowSpeed;
      glowY += (mouseY - glowY) * glowSpeed;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${dotX - 4}px, ${dotY - 4}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringX - 18}px, ${ringY - 18}px)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${glowX - 80}px, ${glowY - 80}px)`;
      }

      // Update particles
      const dt = 0.016;
      const toRemove: number[] = [];
      particlesRef.current.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.vx *= 0.98; // friction
        p.life -= dt / p.maxLife;

        if (p.life <= 0) {
          p.element.remove();
          toRemove.push(i);
        } else {
          p.element.style.transform = `translate(${p.x - p.size / 2}px, ${p.y - p.size / 2}px)`;
          p.element.style.opacity = String(p.life);
        }
      });
      toRemove.reverse().forEach(i => particlesRef.current.splice(i, 1));

      raf = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousemove', checkHover);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('mouseenter', onEnter);
    window.addEventListener('click', onClick);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousemove', checkHover);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('mouseenter', onEnter);
      window.removeEventListener('click', onClick);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(raf);
      // Cleanup particles
      particlesRef.current.forEach(p => p.element.remove());
      particlesRef.current = [];
    };
  }, [spawnParticles, visible]);

  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  const dotSize = pressing ? 6 : hovering ? 5 : 8;
  const ringSize = pressing ? 32 : hovering ? 44 : 36;
  const glowSize = pressing ? 120 : hovering ? 160 : 140;

  return (
    <>
      <div ref={particleContainerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10002 }} />
      <div
        ref={glowRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${glowSize}px`,
          height: `${glowSize}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${currentColor}1f 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s, width 0.4s ease, height 0.4s ease, background 0.4s',
          mixBlendMode: 'screen',
        }}
      />
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${ringSize}px`,
          height: `${ringSize}px`,
          borderRadius: '50%',
          border: `1.5px solid ${hovering ? `${currentColor}99` : 'rgba(255,255,255,0.25)'}`,
          pointerEvents: 'none',
          zIndex: 10000,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s, width 0.4s ease, height 0.4s ease, border-color 0.4s',
        }}
      />
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          borderRadius: '50%',
          background: hovering ? currentColor : '#fff',
          boxShadow: `0 0 ${pressing ? 20 : 8}px ${currentColor}`,
          pointerEvents: 'none',
          zIndex: 10001,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s, width 0.3s ease, height 0.3s ease, background 0.4s, box-shadow 0.4s',
        }}
      />
      <style>{`
        * { cursor: none !important; }
      `}</style>
    </>
  );
}
