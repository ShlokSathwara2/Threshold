"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchSpInternalMarks, fetchAcademiaMarks, isAcademiaLoggedIn } from '@/lib/api';
import type { SubjectAttendance } from '@/lib/attendance-calculator';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import {
  mergeInternalMarks,
  combinedTotal,
  subjectPct,
  gradeFor,
  Ring,
  pctColor,
  type MergedSubjectMark,
} from '@/lib/internal-marks';

export default function InternalMarks({
  refreshKey = 0,
  subjects = [],
}: {
  refreshKey?: number;
  subjects?: SubjectAttendance[];
}) {
  const [marks, setMarks] = useState<MergedSubjectMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academiaOn, setAcademiaOn] = useState(false);

  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const sp = isAcademiaLoggedIn();
      setAcademiaOn(sp);
      try {
        const spRes = fetchSpInternalMarks();
        const acRes = sp ? fetchAcademiaMarks() : Promise.resolve(null);
        const [spOut, acOut] = await Promise.all([spRes, acRes]);
        if (cancelled) return;
        const merged = mergeInternalMarks(
          spOut.internal_marks || [],
          acOut?.marks || [],
        );
        setMarks(merged);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load internal marks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: `1px solid ${WB(0.06)}`,
        textAlign: 'center',
      }}>
        <p style={{ color: W(0.3), fontSize: '0.8rem' }}>Loading internal marks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#fca5a5', fontSize: '0.8rem' }}>{error}</p>
      </div>
    );
  }

  if (marks.length === 0) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: `1px solid ${WB(0.06)}`,
        textAlign: 'center',
      }}>
        <p style={{ color: W(0.3), fontSize: '0.8rem' }}>
          No internal marks published yet{academiaOn ? ' on the portal or Academia' : ''}.
        </p>
      </div>
    );
  }

  const totals = combinedTotal(marks);
  const overallPct = totals.maxMark > 0 ? (totals.scored / totals.maxMark) * 100 : null;
  const best = [...marks].sort((a, b) => (subjectPct(b) ?? -1) - (subjectPct(a) ?? -1))[0] ?? null;
  const worst = [...marks].sort((a, b) => (subjectPct(a) ?? 999) - (subjectPct(b) ?? 999))[0] ?? null;
  const overallColor = pctColor(overallPct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: `1px solid ${WB(0.06)}`,
        marginBottom: '24px',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
            Internal Marks
          </h2>
          <p style={{ fontSize: '0.68rem', color: W(0.4), margin: '4px 0 0' }}>
            {academiaOn ? 'SP totals + Academia test-wise breakdown' : 'Student Portal totals'}
            {academiaOn && marks.some((m) => m.tests.length > 0) ? ' · every component shown' : ''}
          </p>
        </div>
        {overallPct !== null && (
          <Ring pct={overallPct} size={64} stroke={6} color={overallColor} track={WB(0.08)}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: overallColor }}>
              {overallPct.toFixed(0)}%
            </span>
          </Ring>
        )}
      </div>

      {/* Combined total strip */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.14), rgba(59,130,246,0.06))',
        border: '1px solid rgba(var(--threshold-accent-rgb),0.25)',
        marginBottom: '14px',
      }}>
        <div>
          <p style={{
            margin: 0,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--threshold-accent-text)',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
          }}>
            Total Marks
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: 'var(--threshold-text-faint)' }}>
            Combined across {marks.length} subject{marks.length > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--threshold-text)' }}>
            {totals.scored.toFixed(1)}
            <span style={{ color: 'var(--threshold-text-faint)', fontWeight: 500, fontSize: '0.85rem' }}> / </span>
            <span style={{ fontSize: '0.9rem', color: W(0.5), fontWeight: 600 }}>{totals.maxMark.toFixed(0)}</span>
          </span>
          <p style={{ margin: '3px 0 0', fontSize: '0.7rem', fontWeight: 700, color: overallColor }}>
            {overallPct !== null ? `${overallPct.toFixed(1)}%` : '—'}
            {best && worst && best.code !== worst.code
              ? ` · best ${best.code} · lowest ${worst.code}`
              : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {marks.map((m, i) => {
          const pct = subjectPct(m);
          const color = pctColor(pct);
          const att = subjects.find((s) => s.courseCode === m.code);
          const testTotal = m.tests.reduce((acc, t) => acc + (parseFloat(t.marks.total) || 0), 0);
          const testScored = m.tests.reduce((acc, t) => acc + (parseFloat(t.marks.scored) || 0), 0);
          const testsPct = testTotal > 0 ? (testScored / testTotal) * 100 : null;
          const effectivePct = testsPct !== null ? testsPct : pct;

          return (
            <motion.div
              key={`${m.code}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{
                padding: '14px',
                borderRadius: '14px',
                background: WB(0.02),
                border: `1px solid ${WB(0.05)}`,
              }}
            >
              {/* Header: ring + code + totals */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Ring pct={effectivePct} size={56} stroke={5} color={color} track={WB(0.08)}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color }}>
                    {effectivePct !== null ? `${effectivePct.toFixed(0)}%` : '—'}
                  </span>
                </Ring>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
                      {m.code}
                    </span>
                    {pct !== null && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '5px',
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        background: `${color}1a`,
                        color,
                      }}>
                        {gradeFor(pct / 100)}
                      </span>
                    )}
                    {m.tests.length > 0 && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '5px',
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        background: 'rgba(139,92,246,0.14)',
                        color: '#a78bfa',
                      }}>
                        {m.tests.length} component{m.tests.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: W(0.4), margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.description}
                  </p>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color, margin: '3px 0 0' }}>
                    {m.scored.toFixed(1)}
                    <span style={{ color: W(0.3), fontWeight: 400, fontSize: '0.68rem' }}> / {m.maxMark.toFixed(0)}</span>
                    <span style={{ color: W(0.35), fontWeight: 400, fontSize: '0.66rem', marginLeft: '6px' }}>
                      {m.academiaOnly ? 'from Academia' : 'SP total'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Attendance context */}
              {att && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    background: WB(0.04),
                    border: `1px solid ${WB(0.07)}`,
                    color: W(0.55),
                  }}>
                    Present {att.present}/{att.total}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    background: att.canBunk > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${att.canBunk > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: att.canBunk > 0 ? '#4ade80' : '#f87171',
                  }}>
                    {att.canBunk > 0 ? `${att.canBunk} class${att.canBunk > 1 ? 'es' : ''} left` : '0 left — don\u2019t skip'}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    background: att.isBelowThreshold ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${att.isBelowThreshold ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                    color: att.isBelowThreshold ? '#f87171' : '#4ade80',
                  }}>
                    {att.percentage.toFixed(1)}% attendance
                  </span>
                </div>
              )}

              {/* Overall progress bar */}
              <div style={{
                height: '3px',
                borderRadius: '2px',
                background: WB(0.06),
                overflow: 'hidden',
                marginTop: '10px',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${effectivePct ?? 0}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.03 }}
                  style={{ height: '100%', borderRadius: '2px', background: color }}
                />
              </div>

              {/* Dynamic per-test breakdown — any number of components, any names */}
              {m.tests.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {m.tests.map((t, ti) => {
                    const s = parseFloat(t.marks.scored) || 0;
                    const mx = parseFloat(t.marks.total) || 0;
                    const tp = mx > 0 ? (s / mx) * 100 : 0;
                    const tc = pctColor(tp);
                    const wt = t.weightage ? parseFloat(t.weightage) : NaN;
                    return (
                      <div key={`${t.test}-${ti}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}>
                        <span style={{
                          fontSize: '0.68rem',
                          color: W(0.5),
                          minWidth: '88px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {t.test}
                        </span>
                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: WB(0.06), overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${tp}%` }}
                            transition={{ duration: 0.7, delay: 0.3 + ti * 0.05 }}
                            style={{ height: '100%', borderRadius: '3px', background: tc }}
                          />
                        </div>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: tc, flexShrink: 0 }}>
                          {s}<span style={{ color: W(0.3), fontWeight: 400, fontSize: '0.68rem' }}>/{mx}</span>
                        </span>
                        {!isNaN(wt) && (
                          <span style={{ fontSize: '0.58rem', color: W(0.35), flexShrink: 0, minWidth: '34px', textAlign: 'right' }}>
                            {wt}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {!academiaOn && (
        <p style={{
          margin: '12px 0 0',
          fontSize: '0.68rem',
          color: W(0.35),
          textAlign: 'center',
        }}>
          Log in with Academia for the per-test breakdown (FT-1, quizzes, assignments — every component).
        </p>
      )}
      {academiaOn && marks.some((m) => m.tests.length === 0) && (
        <p style={{
          margin: '12px 0 0',
          fontSize: '0.68rem',
          color: W(0.35),
          textAlign: 'center',
        }}>
          Academia is connected — component-wise breakdowns appear here once marks are published.
        </p>
      )}
    </motion.div>
  );
}