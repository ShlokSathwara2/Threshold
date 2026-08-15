"use client";
import { useEffect, useRef } from 'react';

interface PortalRiftProps {
  active: boolean;
  onComplete?: () => void;
}

const PortalRift = ({ active, onComplete }: PortalRiftProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    let frame = 0;
    const totalFrames = 120;
    let animId: number;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; hue: number; life: number }> = [];
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * 400;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        size: 1 + Math.random() * 3,
        hue: 200 + Math.random() * 160,
        life: 1
      });
    }

    const render = () => {
      const progress = frame / totalFrames;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + progress * 0.15})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Portal core
      const portalRadius = progress < 0.5
        ? progress * 2 * 150
        : 150 + (progress - 0.5) * 2 * 300;
      const portalOpacity = progress < 0.3 ? progress / 0.3 : progress > 0.8 ? (1 - progress) / 0.2 : 1;

      // Outer glow
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, portalRadius);
      gradient.addColorStop(0, `rgba(139, 92, 246, ${0.8 * portalOpacity})`);
      gradient.addColorStop(0.3, `rgba(59, 130, 246, ${0.5 * portalOpacity})`);
      gradient.addColorStop(0.6, `rgba(168, 85, 247, ${0.3 * portalOpacity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, portalRadius, 0, Math.PI * 2);
      ctx.fill();

      // Swirl rings
      for (let r = 0; r < 5; r++) {
        const ringAngle = frame * 0.05 * (r % 2 === 0 ? 1 : -1) + r * 1.2;
        const ringRadius = portalRadius * (0.3 + r * 0.15);
        ctx.strokeStyle = `rgba(139, 92, 246, ${(0.6 - r * 0.1) * portalOpacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ringAngle) * ringRadius * 0.2, cy + Math.sin(ringAngle) * ringRadius * 0.2, ringRadius, ringAngle, ringAngle + Math.PI * 1.5);
        ctx.stroke();
      }

      // Particles getting sucked in
      particles.forEach(p => {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = progress * 8;
        p.vx += (dx / dist) * pull;
        p.vy += (dy / dist) * pull;
        p.x += p.vx;
        p.y += p.vy;
        p.life = Math.max(0, 1 - dist / portalRadius);

        if (dist < portalRadius && progress > 0.6) {
          ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.life * portalOpacity})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Final flash
      if (progress > 0.85) {
        const flashProgress = (progress - 0.85) / 0.15;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashProgress * 0.9})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      frame++;
      if (frame < totalFrames) {
        animId = requestAnimationFrame(render);
      } else {
        onComplete?.();
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
};

export default PortalRift;
