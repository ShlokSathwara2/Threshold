"use client";

import { motion } from 'framer-motion';
import type { SgpaProjection } from '@/lib/sgpa-projection';
import { gradeForTotal } from '@/lib/grade-calculator';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

const GRADE_COLORS: Record<string, string> = {
  O: '#34d399',
  'A+': '#4ade80',
  A: '#a3e635',
  'B+': '#facc15',
  B: '#fb923c',
  C: '#f87171',
  F: '#ef4444',
};

function gradeColor(g: string): string {
  return GRADE_COLORS[g] || '#94a3b8';
}

function sgpaText(v: number | null): string {
  return v === null ? '—' : v.toFixed(2);
}

export default function SgpaProjectionCard({ projection }: { projection: SgpaProjection }) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  const { sgpa, publishedPct, publishedScored, publishedTotal, assessments, awaiting, subjects } =
    projection;

  const scenarios = [
    {
      key: 'worst',
      label: 'Worst case',
      hint: 'Only marks already earned',
      value: sgpa.worst,
      tone: '#f87171',
    },
    {
      key: 'projected',
      label: 'Current pace',
      hint: 'Same ratio, full externals',
      value: sgpa.projected,
      tone: 'var(--threshold-accent-text)',
    },
    {
      key: 'best',
      label: 'Best case',
      hint: 'Ace everything left',
      value: sgpa.best,
      tone: '#34d399',
    },
  ];

  return (
    <motion.div
      className="thr-gradient-border"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '18px 16px',
        borderRadius: '18px',
        background: 'var(--threshold-surface)',
        border: '1px solid var(--threshold-border)',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
        <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
          SGPA Forecast
        </p>
        <p style={{ fontSize: '0.68rem', color: W(0.35) }}>
          {subjects.length} subject{subjects.length === 1 ? '' : 's'} · {projection.totalCredits} credits
        </p>
      </div>

      {/* Published performance */}
      <div style={{
        display: 'flex',
        gap: '14px',
        marginTop: '10px',
        marginBottom: '14px',
        padding: '10px 12px',
        borderRadius: '12px',
        background: WB(0.02),
        border: `1px solid ${WB(0.05)}`,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--threshold-text)' }}>
            {publishedPct !== null ? `${publishedPct.toFixed(1)}%` : '—'}
          </p>
          <p style={{ fontSize: '0.66rem', color: W(0.35), marginTop: '2px' }}>
            {publishedScored.toFixed(1)} / {publishedTotal.toFixed(0)} marks earned
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--threshold-text)' }}>
            {assessments || subjects.length}
          </p>
          <p style={{ fontSize: '0.66rem', color: W(0.35), marginTop: '2px' }}>
            assessment{assessments === 1 ? '' : 's'} · {awaiting} awaiting
          </p>
        </div>
      </div>

      {/* Best / current / worst */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {scenarios.map((s, i) => {
          const g = s.value === null ? null : gradeForTotal(s.value * 10);
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              style={{
                padding: '10px 8px',
                borderRadius: '12px',
                textAlign: 'center',
                background: s.key === 'projected' ? 'rgba(139, 92, 246, 0.1)' : WB(0.02),
                border: `1px solid ${s.key === 'projected' ? 'rgba(139, 92, 246, 0.35)' : WB(0.05)}`,
              }}
            >
              <p style={{ fontSize: '0.62rem', fontWeight: 600, color: W(0.4), marginBottom: '4px' }}>
                {s.label}
              </p>
              <p style={{ fontSize: '1.35rem', fontWeight: 800, color: s.tone, lineHeight: 1 }}>
                {sgpaText(s.value)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '6px' }}>
                <span style={{
                  minWidth: '24px',
                  height: '20px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: g ? gradeColor(g.grade) : W(0.3),
                  background: g ? `${gradeColor(g.grade)}1a` : WB(0.03),
                  border: `1px solid ${g ? `${gradeColor(g.grade)}40` : WB(0.06)}`,
                }}>
                  {g ? g.grade : '—'}
                </span>
                <span style={{ fontSize: '0.62rem', color: W(0.3) }}>
                  {s.value !== null ? `${(s.value * 10).toFixed(0)}%` : ''}
                </span>
              </div>
              <p style={{ fontSize: '0.58rem', color: W(0.28), marginTop: '5px', lineHeight: 1.2 }}>
                {s.hint}
              </p>
            </motion.div>
          );
        })}
      </div>

      <p style={{ fontSize: '0.62rem', color: W(0.28), marginTop: '12px', lineHeight: 1.45 }}>
        Forecast: published marks scaled to 60 internals + an assumed 40/40 end-semester
        (theory). Internal-only courses use their own 100. Grades and SGPA are projections,
        not published results.
      </p>
    </motion.div>
  );
}
