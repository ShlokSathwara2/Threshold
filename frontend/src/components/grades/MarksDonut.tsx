"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  subjectPct,
  gradeFor,
  pctColor,
  type MergedSubjectMark,
} from '@/lib/internal-marks';
import ComponentGraph from '@/components/grades/ComponentGraph';

/**
 * Smooth count-up that animates from the *current* displayed value to the new
 * target, so switching the focused subject glides instead of restarting at 0.
 */
function useCountUp(target: number, duration = 850) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = from + (target - from) * eased;
      fromRef.current = v;
      setValue(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

function Donut({
  pct,
  size = 176,
  stroke = 15,
  color,
  track,
  delay = 0,
  children,
}: {
  /** 0–100. The arc sweeps to here with a spring-ish ease. */
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  delay?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  // Random id: useId() emits ':' which is unsafe inside url(#…).
  const gradId = useMemo(() => `mdg-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {stroke > 7 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r - stroke}
            fill="none"
            stroke={track}
            strokeWidth={1}
            strokeDasharray="2 5"
            opacity={0.9}
          />
        )}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c, opacity: 0 }}
          animate={{ strokeDashoffset: c * (1 - clamped / 100), opacity: 1 }}
          transition={{ duration: 1.15, delay, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 ${Math.round(stroke / 2)}px ${color}55)` }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          textAlign: 'center',
          padding: `${stroke + 6}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function gradePillStyle(color: string): React.CSSProperties {
  return {
    padding: '2px 9px',
    borderRadius: '999px',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.3px',
    color,
    background: `${color}1f`,
    border: `1px solid ${color}44`,
  };
}

/**
 * Professional, functional donut for Internal Marks.
 *
 * - Big animated donut: overall internal-marks % by default; tap any subject
 *   in the legend to focus it (the arc, the count-up and the colours transition).
 * - Per-subject mini donuts in the legend, staggered in on mount.
 */
export default function MarksDonut({
  marks,
  overallScored,
  overallMax,
  overallPct,
  W,
  WB,
}: {
  marks: MergedSubjectMark[];
  overallScored: number;
  overallMax: number;
  overallPct: number | null;
  W: (a: number) => string;
  WB: (a: number) => string;
}) {
  const [focus, setFocus] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...marks].sort((a, b) => (subjectPct(b) ?? -1) - (subjectPct(a) ?? -1)),
    [marks],
  );

  const focused = focus ? marks.find((m) => m.code === focus) ?? null : null;
  const pct = focused ? subjectPct(focused) : overallPct;
  const color = pctColor(pct);
  const label = focused ? focused.code : 'ALL SUBJECTS';
  const scored = focused ? focused.scored : overallScored;
  const max = focused ? focused.maxMark : overallMax;
  const display = useCountUp(pct ?? 0);

  return (
    <div
      className="thr-gradient-border"
      style={{
        padding: '18px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: `1px solid ${WB(0.06)}`,
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: W(0.45), letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          Marks overview
        </span>
        {focused ? (
          <motion.button
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setFocus(null)}
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '0.58rem',
              fontWeight: 700,
              cursor: 'pointer',
              color: 'var(--threshold-accent-text)',
              background: 'rgba(var(--threshold-accent-rgb),0.12)',
              border: '1px solid rgba(var(--threshold-accent-rgb),0.3)',
            }}
          >
            ← Overall
          </motion.button>
        ) : (
          <span style={{ fontSize: '0.55rem', color: W(0.3) }}>tap a subject to focus</span>
        )}
      </div>

      {/* Big donut */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <Donut pct={pct ?? 0} color={color} track={WB(0.08)}>
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: '0.52rem',
              fontWeight: 800,
              letterSpacing: '0.6px',
              color: W(0.4),
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </motion.span>
          <span
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              color,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {pct !== null ? `${display.toFixed(1)}%` : '—'}
          </span>
          {pct !== null && <span style={gradePillStyle(color)}>{gradeFor(pct / 100)}</span>}
          <span style={{ fontSize: '0.6rem', color: W(0.4), fontVariantNumeric: 'tabular-nums' }}>
            {scored.toFixed(1)} / {max.toFixed(0)}
          </span>
        </Donut>
      </div>

      {/* Focused subject → its own component-level graph (FT-I, FT-II, …) */}
      {focused && focused.tests.length > 0 && (
        <motion.div
          key={`components-${focused.code}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            marginBottom: '14px',
            paddingTop: '10px',
            borderTop: `1px solid ${WB(0.06)}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '8px',
              marginBottom: '2px',
            }}
          >
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                color: W(0.4),
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
              }}
            >
              {focused.code} · components
            </span>
            <span style={{ fontSize: '0.55rem', color: W(0.3) }}>
              {focused.tests.length} component{focused.tests.length === 1 ? '' : 's'}
            </span>
          </div>
          <ComponentGraph
            points={focused.tests.map((t) => ({
              label: t.test,
              scored: parseFloat(t.marks.scored) || 0,
              max: parseFloat(t.marks.total) || 0,
              weightage: t.weightage,
            }))}
            accent={color}
            W={W}
            WB={WB}
          />
        </motion.div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sorted.map((m, i) => {
          const p = subjectPct(m);
          const clr = pctColor(p);
          const isOn = focus === m.code;
          return (
            <motion.div
              key={m.code}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.35, ease: 'easeOut' }}
              whileTap={{ scale: 0.985 }}
              role="button"
              tabIndex={0}
              aria-label={`Focus ${m.code}`}
              aria-pressed={isOn}
              onClick={() => setFocus((f) => (f === m.code ? null : m.code))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFocus((f) => (f === m.code ? null : m.code));
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 10px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: isOn ? `${clr}14` : WB(0.025),
                border: `1px solid ${isOn ? `${clr}55` : WB(0.05)}`,
                transition: 'background 0.25s, border-color 0.25s',
              }}
            >
              <span
                style={{
                  width: '3px',
                  height: '22px',
                  borderRadius: '3px',
                  background: isOn ? clr : 'transparent',
                  transition: 'background 0.25s',
                  flexShrink: 0,
                }}
              />
              <Donut pct={p ?? 0} size={30} stroke={4} color={clr} track={WB(0.09)} delay={0.15 + i * 0.05} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
                    {m.code}
                  </span>
                  {p !== null && (
                    <span style={{ fontSize: '0.55rem', fontWeight: 800, color: clr }}>
                      {gradeFor(p / 100)}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.62rem',
                    color: W(0.4),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.description}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: clr,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}
              >
                {p !== null ? `${p.toFixed(1)}%` : '—'}
              </span>
              <span
                style={{
                  fontSize: '0.58rem',
                  color: W(0.3),
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  width: '58px',
                  textAlign: 'right',
                }}
              >
                {m.scored.toFixed(0)}/{m.maxMark.toFixed(0)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
