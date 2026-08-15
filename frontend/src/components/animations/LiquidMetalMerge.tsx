"use client";
import { useEffect, useRef } from 'react';

interface LiquidMetalMergeProps {
  active: boolean;
  onComplete?: () => void;
}

const LiquidMetalMerge = ({ active, onComplete }: LiquidMetalMergeProps) => {
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
    const totalFrames = 90;
    let animId: number;

    // Blob nodes for liquid effect
    const blobs: Array<{ x: number; y: number; targetX: number; targetY: number; radius: number; speed: number }> = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 100 + Math.random() * 100;
      blobs.push({
        x: cx + Math.cos(angle) * 50,
        y: cy + Math.sin(angle) * 50,
        targetX: cx + Math.cos(angle) * dist,
        targetY: cy + Math.sin(angle) * dist,
        radius: 40 + Math.random() * 60,
        speed: 0.02 + Math.random() * 0.03
      });
    }

    const render = () => {
      const progress = frame / totalFrames;

      // Dark background fading
      ctx.fillStyle = `rgba(5, 0, 20, ${Math.min(1, progress * 2)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Liquid metal blobs expanding from center
      blobs.forEach((blob, i) => {
        const ease = 1 - Math.pow(1 - Math.min(1, progress * 1.5), 3);
        const wobble = Math.sin(frame * 0.08 + i * 1.5) * 20 * (1 - progress);
        blob.x += (blob.targetX - blob.x) * blob.speed + wobble * 0.1;
        blob.y += (blob.targetY - blob.y) * blob.speed + Math.cos(frame * 0.06 + i) * 10 * 0.1;

        const currentRadius = blob.radius * ease * (progress < 0.5 ? 1 : 1 + (progress - 0.5) * 2);

        // Metallic gradient
        const gradient = ctx.createRadialGradient(
          blob.x - currentRadius * 0.3, blob.y - currentRadius * 0.3, 0,
          blob.x, blob.y, currentRadius
        );
        gradient.addColorStop(0, `rgba(180, 120, 255, ${0.8 * ease})`);
        gradient.addColorStop(0.4, `rgba(80, 40, 160, ${0.7 * ease})`);
        gradient.addColorStop(0.7, `rgba(40, 10, 80, ${0.6 * ease})`);
        gradient.addColorStop(1, 'rgba(10, 0, 30, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Connecting metaball effect
      if (progress > 0.2) {
        const connStrength = Math.min(1, (progress - 0.2) / 0.3);
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < blobs.length; i++) {
          for (let j = i + 1; j < blobs.length; j++) {
            const dx = blobs[j].x - blobs[i].x;
            const dy = blobs[j].y - blobs[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) {
              const alpha = (1 - dist / 200) * 0.3 * connStrength;
              ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(blobs[i].x, blobs[i].y);
              ctx.lineTo(blobs[j].x, blobs[j].y);
              ctx.stroke();
            }
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      // Metallic sheen
      if (progress > 0.4 && progress < 0.8) {
        const sheenProgress = (progress - 0.4) / 0.4;
        const sheenX = sheenProgress * canvas.width * 1.5 - canvas.width * 0.25;
        const sheenGradient = ctx.createLinearGradient(sheenX - 100, 0, sheenX + 100, 0);
        sheenGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        sheenGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.15 * (1 - Math.abs(sheenProgress - 0.5) * 2)})`);
        sheenGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sheenGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Final fill
      if (progress > 0.8) {
        const fillProgress = (progress - 0.8) / 0.2;
        ctx.fillStyle = `rgba(5, 0, 20, ${fillProgress})`;
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

export default LiquidMetalMerge;
