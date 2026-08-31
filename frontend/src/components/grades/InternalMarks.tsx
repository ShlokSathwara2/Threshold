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
  externalMarks,
}: {
  refreshKey?: number;
  subjects?: SubjectAttendance[];
  externalMarks?: import('@/lib/api').InternalMark[] | null;
}) {
  const [marks, setMarks] = useState<MergedSubjectMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [academiaOn, setAcademiaOn] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
        let spOut: { internal_marks?: import('@/lib/api').InternalMark[] } = { internal_marks: externalMarks ?? undefined };
        if (!externalMarks) {
          try {
            spOut = await fetchSpInternalMarks();
          } catch {
            spOut = { internal_marks: [] };
          }
        }
        const acRes = sp ? fetchAcademiaMarks() : Promise.resolve(null);
        const acOut = await acRes;
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
  }, [refreshKey, externalMarks]);

  const toggleExpand = (code: string) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  };

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
  const overallColor = pctColor(overallPct);
  const sorted = [...marks].sort((a, b) => (subjectPct(b) ?? -1) - (subjectPct(a) ?? -1));
  const best = sorted[0] ?? null;
  const worst = sorted[sorted.length - 1] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ marginBottom: '24px' }}
    >
      {/* ── Combined Total Card ── */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.6rem',
                fontWeight: 800,
                background: 'rgba(var(--threshold-accent-rgb),0.14)',
                color: 'var(--threshold-accent-text)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
              }}>
                Internal Marks
              </span>
              <span style={{ fontSize: '0.62rem', color: W(0.35) }}>
                {marks.length} subject{marks.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--threshold-text)' }}>
                {totals.scored.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.85rem', color: W(0.4), fontWeight: 500 }}>
                / {totals.maxMark.toFixed(0)}
              </span>
            </div>
            {overallPct !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: overallColor }}>
                  {overallPct.toFixed(1)}%
                </span>
                {best && worst && best.code !== worst.code && (
                  <span style={{ fontSize: '0.62rem', color: W(0.35) }}>
                    best {best.code} · lowest {worst.code}
                  </span>
                )}
              </div>
            )}
          </div>
          {overallPct !== null && (
            <Ring pct={overallPct} size={68} stroke={6} color={overallColor} track={WB(0.08)}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: overallColor }}>
                {overallPct.toFixed(0)}%
              </span>
            </Ring>
          )}
        </div>
      </div>

      {/* ── Per-Subject Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {marks.map((m, i) => {
          const pct = subjectPct(m);
          const color = pctColor(pct);
          const att = subjects.find((s) => s.courseCode === m.code);
          const isExpanded = expanded[m.code] ?? (m.tests.length > 0 && m.tests.length <= 5);

          return (
            <motion.div
              key={`${m.code}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
              className="thr-gradient-border"
              style={{
                borderRadius: '16px',
                background: 'var(--threshold-surface)',
                border: `1px solid ${WB(0.06)}`,
                overflow: 'hidden',
              }}
            >
              {/* Subject header */}
              <div
                onClick={(e) => {
                  if (m.tests.length > 0) {
                    e.stopPropagation();
                    toggleExpand(m.code);
                  }
                }}
                style={{
                  padding: '14px 16px',
                  cursor: m.tests.length > 0 ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Ring pct={pct} size={52} stroke={5} color={color} track={WB(0.08)}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color }}>
                    {pct !== null ? `${pct.toFixed(0)}%` : '—'}
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
                  <p style={{
                    fontSize: '0.72rem',
                    color: W(0.45),
                    margin: '2px 0 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {m.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color }}>
                      {m.scored.toFixed(1)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: W(0.35), fontWeight: 500 }}>
                      / {m.maxMark.toFixed(0)}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: W(0.3), fontWeight: 400 }}>
                      {m.academiaOnly ? 'Academia' : 'SP total'}
                    </span>
                  </div>
                </div>
                {m.tests.length > 0 && (
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color: W(0.35), fontSize: '0.7rem', flexShrink: 0 }}
                  >
                    ▼
                  </motion.span>
                )}
              </div>

              {/* Attendance row */}
              {att && (
                <div style={{
                  padding: '0 16px 10px',
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.58rem',
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
                    fontSize: '0.58rem',
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
                    fontSize: '0.58rem',
                    fontWeight: 700,
                    background: att.isBelowThreshold ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${att.isBelowThreshold ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                    color: att.isBelowThreshold ? '#f87171' : '#4ade80',
                  }}>
                    {att.percentage.toFixed(1)}% attendance
                  </span>
                </div>
              )}

              {/* Progress bar */}
              <div style={{ padding: '0 16px 12px' }}>
                <div style={{
                  height: '3px',
                  borderRadius: '2px',
                  background: WB(0.06),
                  overflow: 'hidden',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct ?? 0}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.04 }}
                    style={{ height: '100%', borderRadius: '2px', background: color }}
                  />
                </div>
              </div>

              {/* Test breakdown (expandable) */}
              {m.tests.length > 0 && isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    borderTop: `1px solid ${WB(0.06)}`,
                    padding: '12px 16px',
                    background: WB(0.02),
                  }}
                >
                  <p style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: W(0.35),
                    margin: '0 0 8px',
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                  }}>
                    Components
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {m.tests.map((t, ti) => {
                      const s = parseFloat(t.marks.scored) || 0;
                      const mx = parseFloat(t.marks.total) || 0;
                      const tp = mx > 0 ? (s / mx) * 100 : 0;
                      const tc = pctColor(tp);
                      const wt = t.weightage ? parseFloat(t.weightage) : NaN;
                      return (
                        <div key={`${t.test}-${ti}`}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              color: W(0.5),
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0,
                            }}>
                              {t.test}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {!isNaN(wt) && (
                                <span style={{ fontSize: '0.55rem', color: W(0.3) }}>
                                  {wt}%
                                </span>
                              )}
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tc }}>
                                {s}
                                <span style={{ color: W(0.3), fontWeight: 400, fontSize: '0.65rem' }}>/{mx}</span>
                              </span>
                            </div>
                          </div>
                          <div style={{ height: '5px', borderRadius: '3px', background: WB(0.06), overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${tp}%` }}
                              transition={{ duration: 0.6, delay: 0.1 + ti * 0.05 }}
                              style={{ height: '100%', borderRadius: '3px', background: tc }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Footer hint */}
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
