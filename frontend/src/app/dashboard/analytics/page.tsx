"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isSpLoggedIn,
  isCampusWebSession,
  fetchSpGrades,
  fetchSpInternalMarks,
  type GradesResponse,
  type InternalMark,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { LoadingState, ErrorState } from '@/components/ui/States';

const GRADE_POINTS: Record<string, number> = {
  O: 10, S: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, D: 4, P: 3, F: 0,
};

const GRADE_COLORS: Record<string, string> = {
  O: '#34d399',
  'A+': '#6ee7b7',
  A: '#a3e635',
  'B+': '#facc15',
  B: '#fb923c',
  C: '#f87171',
  D: '#ef4444',
  F: '#b91c1c',
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [grades, setGrades] = useState<GradesResponse | null>(null);
  const [internals, setInternals] = useState<InternalMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSem, setSelectedSem] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isCampusWebSession()) {
        throw new Error('Analytics requires the Android app. SRM portal does not allow the website to access grades and internal marks data.');
      }
      const [gRes, iRes] = await Promise.allSettled([
        fetchSpGrades(),
        fetchSpInternalMarks(),
      ]);
      if (gRes.status === 'fulfilled' && gRes.value) {
        setGrades(gRes.value);
      }
      if (iRes.status === 'fulfilled') {
        setInternals(iRes.value.internal_marks || []);
      }
      if (gRes.status === 'rejected' && iRes.status === 'rejected') {
        throw new Error('Could not load analytics data');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSpLoggedIn()) {
      router.push('/sp-login');
      return;
    }
    load();
  }, [router, load]);
  usePullToRefresh(load);

  const semesters = useMemo(
    () => (grades?.semesters || []).filter((s) => s.sgpa !== null),
    [grades]
  );
  const latestSem = useMemo(
    () => (grades?.semesters || []).filter((s) => s.grades.length > 0).pop(),
    [grades]
  );

  const allSemesters = useMemo(() => grades?.semesters || [], [grades]);
  const activeSem = useMemo(() => {
    if (selectedSem === null) return latestSem ?? null;
    return allSemesters.find((s) => s.semester === selectedSem) ?? latestSem ?? null;
  }, [selectedSem, allSemesters, latestSem]);

  const gradeCounts = useMemo(() => {
    const counts: { grade: string; count: number }[] = [];
    if (!activeSem) return counts;
    const map = new Map<string, number>();
    for (const g of activeSem.grades) {
      map.set(g.grade, (map.get(g.grade) || 0) + 1);
    }
    for (const [grade, count] of map.entries()) {
      counts.push({ grade, count });
    }
    return counts.sort((a, b) => (GRADE_POINTS[b.grade] || 0) - (GRADE_POINTS[a.grade] || 0));
  }, [activeSem]);

  const maxSgpa = useMemo(
    () => Math.max(10, ...semesters.map((s) => s.sgpa ?? 0)),
    [semesters]
  );
  const bestSem = useMemo(() => {
    let best: number | null = null;
    for (const s of semesters) {
      if (s.sgpa !== null && (best === null || s.sgpa > best)) best = s.sgpa;
    }
    return best;
  }, [semesters]);

  const chart = useMemo(() => {
    const n = semesters.length;
    if (n === 0) return null;
    const plotX = 8;
    const plotW = 312;
    const plotTop = 14;
    const plotH = 104;
    const slot = plotW / n;
    const barW = Math.min(34, slot * 0.55);
    return semesters.map((s, i) => {
      const h = ((s.sgpa ?? 0) / maxSgpa) * plotH;
      const x = plotX + i * slot + (slot - barW) / 2;
      const isBest = s.sgpa === bestSem;
      const isSelected = activeSem?.semester === s.semester;
      return { x, y: plotTop + plotH - h, w: barW, h, sem: s.semester, sgpa: s.sgpa, isBest, isSelected };
    });
  }, [semesters, maxSgpa, bestSem, activeSem]);

  const totalScored = internals.reduce((acc, m) => acc + (parseFloat(m.scored) || 0), 0);
  const totalMax = internals.reduce((acc, m) => acc + (parseFloat(m.maxMark) || 0), 0);
  const internalPct = totalMax > 0 ? (totalScored / totalMax) * 100 : null;

  function gradeFor(avg: number): string {
    if (avg >= 0.9) return 'O';
    if (avg >= 0.85) return 'A+';
    if (avg >= 0.8) return 'A';
    if (avg >= 0.75) return 'B+';
    if (avg >= 0.7) return 'B';
    if (avg >= 0.6) return 'C';
    if (avg >= 0.5) return 'D';
    return 'F';
  }

  const stats = [
    { label: 'Semesters', value: String(semesters.length) },
    {
      label: 'Credits earned',
      value: grades?.credits_earned != null ? String(grades.credits_earned) : '—',
    },
    {
      label: 'Credits registered',
      value: grades?.credits_registered != null ? String(grades.credits_registered) : '—',
    },
  ];

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '20px' }}
      >
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'var(--threshold-text)',
          marginBottom: '4px',
        }}>
          Analytics
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Your performance across semesters
        </p>
      </motion.div>

      {loading ? (
        <LoadingState label="Crunching the numbers…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {/* CGPA hero */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              borderRadius: '20px',
              padding: '22px',
              marginBottom: '16px',
              background: 'linear-gradient(150deg, rgba(139, 92, 246, 0.22), rgba(217, 70, 239, 0.08))',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
            }}
          >
            <div style={{
              flexShrink: 0,
              width: '86px',
              height: '86px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--threshold-accent), #d946ef)',
              boxShadow: '0 8px 28px rgba(139, 92, 246, 0.35)',
            }}>
              <p style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--threshold-text)',
                lineHeight: 1,
              }}>
                {grades?.cgpa != null ? grades.cgpa.toFixed(2) : '—'}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: W(0.45),
                marginBottom: '4px',
              }}>
                Cumulative CGPA
              </p>
              <p style={{
                fontSize: '0.8rem',
                color: W(0.55),
                lineHeight: 1.5,
              }}>
                {grades?.credits_required != null
                  ? `${grades.credits_earned ?? 0} of ${grades.credits_required} credits earned so far`
                  : 'Aggregate of all completed semesters'}
              </p>
            </div>
          </motion.div>

          {/* Stat cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '16px',
          }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                padding: '14px 8px',
                borderRadius: '14px',
                background: WB(0.02),
                border: `1px solid ${WB(0.06)}`,
                textAlign: 'center',
              }}>
                <p style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: 'var(--threshold-accent-text)',
                  lineHeight: 1,
                }}>
                  {s.value}
                </p>
                <p style={{
                  fontSize: '0.6rem',
                  color: W(0.4),
                  marginTop: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* SGPA chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              borderRadius: '18px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              padding: '18px 16px 14px',
              marginBottom: '16px',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '12px',
            }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
                SGPA by semester
              </p>
              <p style={{ fontSize: '0.68rem', color: W(0.35) }}>
                best {bestSem?.toFixed(2) ?? '—'}
              </p>
            </div>
            {chart ? (
              <>
                <p style={{ fontSize: '0.66rem', color: W(0.35), marginBottom: '8px', textAlign: 'center' }}>
                  Tap a bar to view that semester
                </p>
                <svg viewBox="0 0 328 150" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {[0.25, 0.5, 0.75, 1].map((f) => (
                    <line
                      key={f}
                      x1={8}
                      x2={320}
                      y1={14 + 104 * (1 - f)}
                      y2={14 + 104 * (1 - f)}
                      stroke={WB(0.06)}
                      strokeWidth={1}
                    />
                  ))}
                  {chart.map((b) => (
                    <g
                      key={b.sem}
                      onClick={() => setSelectedSem(b.sem)}
                      style={{ cursor: 'pointer' }}
                    >
                      <motion.rect
                        x={b.x}
                        width={b.w}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        style={{ transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h}px` }}
                        rx={6}
                        fill={b.isSelected ? 'url(#sgpaGrad)' : b.isBest ? W(0.3) : W(0.22)}
                        y={b.y}
                        height={Math.max(b.h, 2)}
                        stroke={b.isSelected ? 'var(--threshold-accent-text)' : 'none'}
                        strokeWidth={b.isSelected ? 1.5 : 0}
                      />
                      <text
                        x={b.x + b.w / 2}
                        y={b.y - 5}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight={b.isSelected || b.isBest ? 800 : 600}
                        fill={b.isSelected ? 'var(--threshold-accent-text)' : W(0.5)}
                      >
                        {b.sgpa?.toFixed(2)}
                      </text>
                      <text
                        x={b.x + b.w / 2}
                        y={140}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight={b.isSelected ? 800 : 600}
                        fill={b.isSelected ? 'var(--threshold-accent-text)' : W(0.35)}
                      >
                        S{b.sem}
                      </text>
                    </g>
                  ))}
                  <defs>
                    <linearGradient id="sgpaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d946ef" />
                      <stop offset="100%" stopColor="var(--threshold-accent)" />
                    </linearGradient>
                  </defs>
                </svg>
              </>
            ) : (
              <p style={{ fontSize: '0.78rem', color: W(0.35), textAlign: 'center', padding: '20px 0' }}>
                No semester results yet — results appear after your first exams.
              </p>
            )}
          </motion.div>

          {/* Selected semester grade distribution */}
          {activeSem && activeSem.grades.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                borderRadius: '18px',
                background: WB(0.02),
                border: `1px solid ${WB(0.06)}`,
                padding: '18px 16px',
                marginBottom: '16px',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '12px',
              }}>
                <p style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--threshold-text)',
                }}>
                  Semester {activeSem.semester} grades
                </p>
                <p style={{ fontSize: '0.68rem', color: W(0.35) }}>
                  SGPA {activeSem.sgpa?.toFixed(2) ?? '—'}
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {gradeCounts.map((g) => (
                  <div
                    key={g.grade}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '7px 12px',
                      borderRadius: '12px',
                      background: `${GRADE_COLORS[g.grade] || W(0.2)}1a`,
                      border: `1px solid ${GRADE_COLORS[g.grade] || W(0.2)}40`,
                    }}
                  >
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: GRADE_COLORS[g.grade] || W(0.6),
                    }}>
                      {g.grade}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      color: W(0.45),
                      fontWeight: 600,
                    }}>
                      ×{g.count}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeSem.grades.map((g) => (
                  <div
                    key={g.code}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      background: WB(0.02),
                      border: `1px solid ${WB(0.05)}`,
                    }}
                  >
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: W(0.6),
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {g.description}
                    </span>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: GRADE_COLORS[g.grade] || W(0.6),
                      flexShrink: 0,
                    }}>
                      {g.grade}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Internal marks bars */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              borderRadius: '18px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              padding: '18px 16px',
              marginBottom: '16px',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '14px',
            }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
                Internal marks this semester
              </p>
              {internalPct !== null && (
                <p style={{ fontSize: '0.68rem', color: W(0.35) }}>
                  avg {internalPct.toFixed(0)}%
                </p>
              )}
            </div>
            {internals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {internals.map((m, i) => {
                  const scored = parseFloat(m.scored);
                  const max = parseFloat(m.maxMark);
                  const pct = !isNaN(scored) && !isNaN(max) && max > 0 ? (scored / max) * 100 : null;
                  const color = pct === null ? W(0.3) : pct >= 60 ? '#34d399' : pct >= 40 ? '#facc15' : '#f87171';
                  return (
                    <div key={m.code}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '5px',
                      }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: W(0.6),
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {m.description}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color,
                          flexShrink: 0,
                        }}>
                          {m.scored}/{m.maxMark || '—'}
                        </span>
                      </div>
                      <div style={{
                        height: '8px',
                        borderRadius: '999px',
                        background: WB(0.06),
                        overflow: 'hidden',
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct === null ? 0 : Math.min(100, pct)}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: 'easeOut' }}
                          style={{
                            height: '100%',
                            borderRadius: '999px',
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: W(0.35), textAlign: 'center', padding: '12px 0' }}>
                No internal marks published yet this semester.
              </p>
            )}
          </motion.div>

          {/* Grade projection */}
          {internals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              style={{
                borderRadius: '18px',
                background: WB(0.02),
                border: `1px solid ${WB(0.06)}`,
                padding: '18px 16px',
                marginBottom: '16px',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '14px',
              }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
                  Grade projection
                </p>
                <p style={{ fontSize: '0.68rem', color: W(0.35) }}>
                  what your next assessment needs
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {internals.map((m) => {
                  const scored = parseFloat(m.scored);
                  const max = parseFloat(m.maxMark);
                  if (isNaN(scored) || isNaN(max) || max <= 0) return null;
                  const avg = scored / max;
                  const pctA = Math.max(0, 0.8 * (max + 100) - scored);
                  const pctO = Math.max(0, 0.9 * (max + 100) - scored);
                  return (
                    <div key={m.code} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '11px 13px',
                      borderRadius: '12px',
                      background: WB(0.02),
                      border: `1px solid ${WB(0.05)}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.description}
                        </p>
                        <p style={{ fontSize: '0.66rem', color: W(0.4), margin: '3px 0 0' }}>
                          {m.scored}/{m.maxMark} · avg {(avg * 100).toFixed(0)}% · {gradeFor(avg)}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '0.62rem', fontWeight: 600, color: '#fbbf24', margin: 0 }}>
                          A (80%): {Math.ceil(pctA)}/100
                        </p>
                        <p style={{ fontSize: '0.62rem', fontWeight: 600, color: '#34d399', margin: '3px 0 0' }}>
                          O (90%): {Math.ceil(pctO)}/100
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.62rem', color: W(0.3), margin: '12px 0 0', lineHeight: 1.5 }}>
                Assumes one remaining assessment worth 100 marks of equal weight. Grades follow SRM&apos;s
                O/A+/A/B+/B/C/D/F banding.
              </p>
            </motion.div>
          )}

          <p style={{
            textAlign: 'center',
            color: W(0.3),
            fontSize: '0.72rem',
            margin: '18px 0 6px',
          }}>
            Pull down to refresh
          </p>
        </>
      )}
    </div>
  );
}