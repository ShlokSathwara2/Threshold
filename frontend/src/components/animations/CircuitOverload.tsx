"use client";
import { useEffect, useRef } from 'react';

interface CircuitOverloadProps {
  active: boolean;
  onComplete?: () => void;
}

const CircuitOverload = ({ active, onComplete }: CircuitOverloadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Generate circuit paths
    const paths: Array<{ points: Array<{x: number; y: number}>; delay: number; color: string }> = [];
    const grid = 60;
    for (let i = 0; i < 40; i++) {
      const points: Array<{x: number; y: number}> = [];
      let x = Math.floor(canvas.width / 2 / grid) * grid;
      let y = Math.floor(canvas.height / 2 / grid) * grid;
      const steps = 8 + Math.floor(Math.random() * 12);
      for (let s = 0; s < steps; s++) {
        points.push({ x, y });
        const dir = Math.floor(Math.random() * 4);
        const len = (1 + Math.floor(Math.random() * 3)) * grid;
        if (dir === 0) x += len;
        else if (dir === 1) x -= len;
        else if (dir === 2) y += len;
        else y -= len;
        x = Math.max(0, Math.min(canvas.width, x));
        y = Math.max(0, Math.min(canvas.height, y));
      }
      paths.push({
        points,
        delay: i * 2,
        color: `hsl(${180 + Math.random() * 80}, 90%, ${50 + Math.random() * 20}%)`
      });
    }

    let frame = 0;
    const totalFrames = 100;
    let animId: number;

    const render = () => {
      const progress = frame / totalFrames;
      ctx.fillStyle = `rgba(0, 5, 15, ${0.08 + progress * 0.1})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw circuit paths with electric pulse
      paths.forEach(path => {
        const pathProgress = Math.max(0, (progress * totalFrames - path.delay) / (totalFrames - path.delay));
        if (pathProgress <= 0) return;

        const visiblePoints = Math.floor(pathProgress * path.points.length);
        if (visiblePoints < 2) return;

        // Draw circuit line
        ctx.strokeStyle = path.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < visiblePoints; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();

        // Draw pulse at tip
        const tipIdx = Math.min(visiblePoints, path.points.length - 1);
        const tip = path.points[tipIdx];
        const pulseGradient = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 15);
        pulseGradient.addColorStop(0, `rgba(255, 255, 255, 0.9)`);
        pulseGradient.addColorStop(0.3, path.color);
        pulseGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = pulseGradient;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 15, 0, Math.PI * 2);
        ctx.fill();

        // Draw node at joints
        if (visiblePoints > 1) {
          ctx.fillStyle = path.color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.globalAlpha = 1;

      // Central glow expanding
      if (progress > 0.3) {
        const glowProgress = (progress - 0.3) / 0.7;
        const glowRadius = glowProgress * Math.max(canvas.width, canvas.height) * 0.8;
        const glowGradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, glowRadius);
        glowGradient.addColorStop(0, `rgba(100, 200, 255, ${0.15 * (1 - glowProgress)})`);
        glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Final flash
      if (progress > 0.85) {
        const flashProgress = (progress - 0.85) / 0.15;
        ctx.fillStyle = `rgba(200, 240, 255, ${flashProgress * 0.8})`;
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

export default CircuitOverload;
