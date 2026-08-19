"use client";

import { useCallback, useRef, useState } from 'react';
import type { OverallStats, SubjectAttendance } from '@/lib/attendance-calculator';
import { FileBridge } from '@/lib/backup';

const W = 1080;
const H = 1620;

interface Props {
  subjects: SubjectAttendance[];
  overall: OverallStats;
  name?: string;
  style?: React.CSSProperties;
  label?: string;
}

function hexToRgba(hex: string, a: number): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

function drawCard(canvas: HTMLCanvasElement, subjects: SubjectAttendance[], overall: OverallStats, name: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0716');
  bg.addColorStop(0.5, '#101028');
  bg.addColorStop(1, '#0a0a16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 150, 20, W / 2, 150, 480);
  glow.addColorStop(0, 'rgba(139,92,246,0.35)');
  glow.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 600);

  // Ring
  const cx = W / 2;
  const cy = 380;
  const r = 190;
  const pct = overall.overallPercentage;
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, '#8b5cf6');
  grad.addColorStop(0.5, '#d946ef');
  grad.addColorStop(1, '#3b82f6');
  ctx.strokeStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(100, pct)) / 100);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 150px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${pct.toFixed(1)}%`, cx, cy + 48);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 42px Inter, sans-serif';
  ctx.fillText('OVERALL ATTENDANCE', cx, cy + 120);

  if (name) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 52px Inter, sans-serif';
    ctx.fillText(name, cx, 160);
  }

  // Subjects
  const top = 700;
  const rowH = 96;
  const shown = subjects.slice(0, 8);
  shown.forEach((s, i) => {
    const y = top + i * rowH;
    const subPct = s.percentage;
    const color = subPct >= 75 ? '#34d399' : subPct >= 60 ? '#facc15' : '#f87171';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 36px Inter, sans-serif';
    const label = (s.courseTitle || s.courseCode).slice(0, 34);
    ctx.fillText(label, 90, y + 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = '800 38px Inter, sans-serif';
    ctx.fillText(`${subPct.toFixed(1)}%`, W - 90, y + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(90, y + 52, W - 180, 16);
    ctx.fillStyle = color;
    ctx.fillRect(90, y + 52, (W - 180) * Math.min(1, subPct / 100), 16);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '600 34px Inter, sans-serif';
  ctx.fillText('made with THRESHOLD', cx, H - 70);
}

export default function ShareCard({ subjects, overall, name, style, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const share = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    setBusy(true);
    setErr('');
    try {
      drawCard(canvas, subjects, overall, name ?? '');
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('render failed');
      const file = new File([blob], 'threshold-attendance.png', { type: 'image/png' });
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ files: [file], title: 'My attendance' });
      } else {
        const reader = new FileReader();
        const b64 = await new Promise<string>((res) => {
          reader.onload = () => res(String(reader.result).split(',')[1] ?? '');
          reader.readAsDataURL(blob);
        });
        await FileBridge.saveToDownloads({ filename: 'threshold-attendance.png', mime: 'image/png', data: b64 });
      }
    } catch (e) {
      setErr(e instanceof Error && e.message.includes('share') ? '' : 'Could not share right now');
    } finally {
      setBusy(false);
    }
  }, [subjects, overall, name, busy]);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button
        onClick={share}
        disabled={busy}
        style={{
          ...style,
          border: 'none',
          cursor: busy ? 'wait' : 'pointer',
          padding: style?.padding ?? '12px 18px',
          borderRadius: style?.borderRadius ?? '14px',
          background: style?.background ?? 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(217,70,239,0.85))',
          color: style?.color ?? '#fff',
          fontSize: style?.fontSize ?? '0.82rem',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {busy ? 'Rendering…' : label ?? '📤 Share attendance'}
      </button>
      {err && <p style={{ fontSize: '0.66rem', color: '#f87171', margin: '6px 0 0' }}>{err}</p>}
    </>
  );
}