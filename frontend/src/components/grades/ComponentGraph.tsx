"use client";

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pctColor } from '@/lib/internal-marks';

export interface ComponentPoint {
  label: string;
  scored: number;
  max: number;
  /** Optional weight (percent) shown in the detail strip. */
  weightage?: string | number;
}

const HEIGHT = 152;
const PAD_TOP = 18;
const PAD_BOTTOM = 32;
const PAD_X = 14;
const BASELINE = HEIGHT - PAD_BOTTOM;
const PLOT_H = BASELINE - PAD_TOP;

const pctOf = (p: ComponentPoint) => (p.max > 0 ? (p.scored / p.max) * 100 : 0);
const short = (s: string) => (s.length > 9 ? `${s.slice(0, 8)}…` : s);

/**
 * Animated component-level bar graph for one subject (FT-I, FT-II, quizzes…).
 *
 * - Bars grow in with a staggered ease and are coloured by percentage.
 * - 75% reference line so a component's standing is obvious at a glance.
 * - Tap/click any bar for the exact scored / max, percentage and weight.
 * - Scrolls horizontally only when a subject has many components.
 */
export default function ComponentGraph({
  points,
  accent,
  W,
  WB,
  compact = false,
}: {
  points: ComponentPoint[];
  accent: string;
  W: (a: number) => string;
  WB: (a: number) => string;
  compact?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  // One gradient id per mounted graph; useId() emits ':' which breaks url(#…).
  const gid = useMemo(() => `cg-${Math.random().toString(36).slice(2, 9)}`, []);

  const n = points.length;
  if (n === 0) return null;

  // Keep bars readable on phones: fit up to 7 components, otherwise scroll.
  const width = Math.max(300, n * 46);
  const plotW = width - PAD_X * 2;
  const step = plotW / n;
  const barW = Math.min(30, step * 0.54);
  const yOf = (pct: number) => PAD_TOP + PLOT_H * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const activePoint = active !== null ? points[active] : null;

  return (
    <div>
      <div style={{ overflowX: n > 7 ? 'auto' : 'visible', overflowY: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={n > 7 ? width : '100%'}
          height={compact ? 128 : HEIGHT}
          role="img"
          aria-label="Component-wise marks graph"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            {points.map((p, i) => {
              const clr = pctColor(pctOf(p));
              return (
                <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={clr} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={clr} stopOpacity="0.95" />
                </linearGradient>
              );
            })}
          </defs>

          {/* Grid */}
          {[0, 25, 50, 75, 100].map((g) => (
            <line
              key={g}
              x1={PAD_X}
              x2={width - PAD_X}
              y1={yOf(g)}
              y2={yOf(g)}
              stroke={g === 75 ? `${accent}66` : WB(0.07)}
              strokeWidth={1}
              strokeDasharray={g === 0 ? undefined : '3 5'}
            />
          ))}

          {/* 75% reference label */}
          <text
            x={width - PAD_X}
            y={yOf(75) - 4}
            textAnchor="end"
            fontSize="7"
            fontWeight={700}
            fill={`${accent}cc`}
          >
            75%
          </text>

          {points.map((p, i) => {
            const pct = pctOf(p);
            const clr = pctColor(pct);
            const cx = PAD_X + step * i + step / 2;
            const h = Math.max(0, PLOT_H - (yOf(pct) - PAD_TOP));
            const on = active === i;
            const dim = active !== null && !on;
            return (
              <g key={`${p.label}-${i}`} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity 0.2s' }}>
                {on && (
                  <rect
                    x={cx - step / 2 + 2}
                    y={PAD_TOP - 4}
                    width={Math.max(0, step - 4)}
                    height={PLOT_H + 4}
                    rx={6}
                    fill={WB(0.04)}
                  />
                )}
                <motion.rect
                  x={cx - barW / 2}
                  width={barW}
                  rx={4}
                  fill={`url(#${gid}-${i})`}
                  stroke={on ? clr : 'transparent'}
                  strokeWidth={1}
                  initial={{ height: 0, y: BASELINE }}
                  animate={{ height: h, y: yOf(pct) }}
                  transition={{ duration: 0.65, delay: 0.08 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                />
                <text
                  x={cx}
                  y={Math.max(9, yOf(pct) - 5)}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight={700}
                  fill={clr}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {p.max > 0 ? `${Math.round(pct)}%` : '—'}
                </text>
                <text x={cx} y={HEIGHT - 12} textAnchor="middle" fontSize="7" fill={W(0.4)}>
                  {short(p.label)}
                </text>
                {/* Full-column hit target — easy to tap on a phone. */}
                <rect
                  x={cx - step / 2}
                  y={PAD_TOP - 4}
                  width={step}
                  height={PLOT_H + 8}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setActive((a) => (a === i ? null : i))}
                  onMouseEnter={() => setActive(i)}
                >
                  <title>{`${p.label}: ${p.scored}/${p.max} (${Math.round(pct)}%)`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail strip — replaces floating tooltips, which are fiddly on touch. */}
      <div style={{ minHeight: '22px', marginTop: '4px' }}>
        <AnimatePresence mode="wait" initial={false}>
          {activePoint ? (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                flexWrap: 'wrap',
                fontSize: '0.6rem',
                color: W(0.5),
              }}
            >
              <span style={{ fontWeight: 800, color: 'var(--threshold-text)' }}>{activePoint.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {activePoint.scored.toFixed(activePoint.scored % 1 ? 1 : 0)} /{' '}
                {activePoint.max.toFixed(activePoint.max % 1 ? 1 : 0)}
              </span>
              <span
                style={{
                  fontWeight: 800,
                  color: pctColor(pctOf(activePoint)),
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {activePoint.max > 0 ? `${pctOf(activePoint).toFixed(1)}%` : '—'}
              </span>
              {activePoint.weightage !== undefined && activePoint.weightage !== '' && (
                <span style={{ color: W(0.3) }}>weight {activePoint.weightage}%</span>
              )}
            </motion.div>
          ) : (
            <motion.span
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: '0.55rem', color: W(0.28) }}
            >
              tap a bar for the exact split
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
