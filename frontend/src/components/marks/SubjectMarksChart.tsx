"use client";

import { motion } from 'framer-motion';
import type { Mark, TestPerformance } from '@/lib/api';

function parseNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function Chart({ points, maxVal }: { points: { x: number; y: number; t: number }[]; maxVal: number }) {
  const W = 320;
  const H = 120;
  const PAD = 8;

  const toX = (i: number, n: number) => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - (v / Math.max(1, maxVal)) * (H - PAD * 2);

  const line = points.map((p, i) => `${toX(i, points.length)},${toY(p.y)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* baseline */}
      <line x1={PAD} y1={toY(0)} x2={W - PAD} y2={toY(0)} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* total envelope */}
      {points.length > 1 && (
        <polyline
          points={points.map((p, i) => `${toX(i, points.length)},${toY(p.t)}`).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
      )}
      {/* scored line */}
      <motion.polyline
        points={line}
        fill="none"
        stroke="var(--threshold-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
      />
      {/* dots */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={toX(i, points.length)}
          cy={toY(p.y)}
          r={i === points.length - 1 ? 4 : 3}
          fill={i === points.length - 1 ? 'var(--threshold-accent-text)' : 'var(--threshold-accent)'}
          stroke="#09090f"
          strokeWidth="1.5"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.08 }}
        />
      ))}
    </svg>
  );
}

export default function SubjectMarksChart({ subject }: { subject: Mark }) {
  const tests: TestPerformance[] = subject.testPerformance || [];

  let cumScored = 0;
  let cumTotal = 0;
  const points: { x: number; y: number; t: number }[] = [{ x: 0, y: 0, t: 0 }];
  for (const t of tests) {
    cumScored += parseNum(t.marks.scored);
    cumTotal += parseNum(t.marks.total);
    points.push({ x: points.length, y: cumScored, t: cumTotal });
  }

  const overallScored = parseNum(subject.overall?.scored ?? '');
  const overallTotal = parseNum(subject.overall?.total ?? '');
  const maxVal = Math.max(cumTotal, overallTotal, 60);

  return (
    <div>
      <Chart points={points} maxVal={maxVal} />

      {/* Test rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
        {tests.map((t, i) => {
          const s = parseNum(t.marks.scored);
          const m = parseNum(t.marks.total);
          const pct = m > 0 ? (s / m) * 100 : 0;
          const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444';
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <span style={{
                fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.45)',
                minWidth: '72px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {t.test}
              </span>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                  style={{ height: '100%', borderRadius: '2px', background: color }}
                />
              </div>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: color,
                flexShrink: 0,
              }}>
                {s}<span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, fontSize: '0.7rem' }}>/{m}</span>
              </span>
            </div>
          );
        })}
        {tests.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', textAlign: 'center', padding: '10px' }}>
            No test components entered yet â€” starts at 0/0
          </p>
        )}
      </div>
    </div>
  );
}