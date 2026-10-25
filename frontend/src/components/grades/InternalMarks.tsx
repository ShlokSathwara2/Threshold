"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchSpInternalMarks, fetchSpInternalMarksDetail, fetchAcademiaMarks, isAcademiaLoggedIn, type Mark, type InternalMark, type InternalMarkComponent } from '@/lib/api';
import type { SubjectAttendance } from '@/lib/attendance-calculator';
import { getCached, setCached } from '@/lib/cache';
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
import MarksDonut from '@/components/grades/MarksDonut';
import ComponentGraph from '@/components/grades/ComponentGraph';

function fmtPct(v: string | number): string {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(1).replace(/\.0$/, '');
}

const GRADES = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'];
const gradeColor = (g: string): string =>
  g === 'O' || g === 'A+' || g === 'A' ? '#34d399' : g === 'F' ? '#f87171' : '#facc15';

// Saved copies so a slow / expired portal never blanks the marks. All three
// are session-scoped by lib/cache, so a friend signing in on the same phone
// never sees (or overwrites) this student's marks.
const MARKS_CACHE = 'internalMarksMerged';
const SP_ROWS_CACHE = 'internalMarksSpRows';
const DETAILS_CACHE = 'internalMarksDetails';

type CachedDetail = {
  loading: boolean;
  error?: string;
  components: InternalMarkComponent[];
  attempts?: string[];
};

export default function InternalMarks({
  refreshKey = 0,
  subjects = [],
  externalMarks,
  externalMarksRaw,
  charts = false,
}: {
  refreshKey?: number;
  subjects?: SubjectAttendance[];
  externalMarks?: import('@/lib/api').InternalMark[] | null;
  /**
   * Campus Web marks (adapted to Mark[]) — carries the component-wise
   * breakdown (FT-I, FT-II, …) plus each subject's total, exactly as the
   * Campus Web site shows it.
   */
  externalMarksRaw?: Mark[] | null;
  /** Show the analysis charts (Internal Marks page only — never the home card). */
  charts?: boolean;
}) {
  const [marks, setMarks] = useState<MergedSubjectMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [academiaOn, setAcademiaOn] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // The Student Portal exposes a per-subject component split behind its
  // "View Details" button. We keep the SP rows (which carry subjectId +
  // status) and lazily load the breakdown on demand.
  const [spRows, setSpRows] = useState<Record<string, InternalMark>>({});
  const [details, setDetails] = useState<Record<string, CachedDetail>>({});

  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  useEffect(() => {
    let cancelled = false;

    // Paint the last saved copy first so marks stay visible while the portal
    // is slow, offline, or the Academia/SP session has expired.
    const savedMarks = getCached<MergedSubjectMark[]>(MARKS_CACHE);
    const savedSpRows = getCached<Record<string, InternalMark>>(SP_ROWS_CACHE);
    const savedDetails = getCached<Record<string, CachedDetail>>(DETAILS_CACHE);
    if (savedMarks?.data.length) {
      setMarks(savedMarks.data);
      setLoading(false);
    }
    if (savedSpRows?.data) setSpRows(savedSpRows.data);
    if (savedDetails?.data) {
      setDetails(
        Object.fromEntries(
          Object.entries(savedDetails.data).map(([code, d]) => [
            code,
            { ...d, loading: false },
          ])
        )
      );
    }

    (async () => {
      setError(null);
      const academiaOn = isAcademiaLoggedIn();
      setAcademiaOn(academiaOn);
      try {
        const acOut = academiaOn ? await fetchAcademiaMarks().catch(() => null) : null;
        if (cancelled) return;

        let nextMarks: MergedSubjectMark[] = [];
        if (externalMarksRaw && externalMarksRaw.length > 0) {
          // Campus Web session: the component-wise breakdown and totals come
          // straight from /api/auth/user/ — no Student Portal involved.
          nextMarks = mergeInternalMarks([], acOut?.marks || [], externalMarksRaw);
        } else {
          let spMarks: import('@/lib/api').InternalMark[] | null =
            externalMarks && externalMarks.length > 0 ? externalMarks : null;
          if (!spMarks) {
            try {
              spMarks = (await fetchSpInternalMarks()).internal_marks || [];
            } catch {
              spMarks = [];
            }
            // The portal fetch is slow: if this run was superseded while it
            // was in flight, its (usually empty) result must not overwrite
            // the newer data.
            if (cancelled) return;
          }
          if (spMarks.length) {
            const rows = Object.fromEntries(spMarks.map((m) => [m.code, m]));
            setSpRows(rows);
            setCached(SP_ROWS_CACHE, rows);
          }
          nextMarks = mergeInternalMarks(spMarks ?? [], acOut?.marks || []);
        }

        if (cancelled) return;
        if (nextMarks.length > 0) {
          setMarks(nextMarks);
          setCached(MARKS_CACHE, nextMarks);
          setStale(false);
        } else if (savedMarks?.data.length) {
          // Empty answer from a dead session / partial parse: keep the saved
          // marks and flag them instead of showing "no marks published".
          setStale(true);
        } else {
          setMarks([]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          if (savedMarks?.data.length) {
            setStale(true);
          } else {
            setError(e instanceof Error ? e.message : 'Failed to load internal marks');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, externalMarks, externalMarksRaw]);

  // Persist the component tabs as they are opened so they too survive an
  // expired session (only successful, non-empty breakdowns are saved).
  useEffect(() => {
    if (loading) return;
    const clean = Object.fromEntries(
      Object.entries(details).filter(
        ([, d]) => d && !d.loading && !d.error && d.components.length > 0
      )
    );
    if (Object.keys(clean).length > 0) {
      setCached(DETAILS_CACHE, clean);
    }
  }, [details, loading]);

  const toggleExpand = (code: string) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const loadDetail = useCallback(async (code: string) => {
    const src = spRows[code];
    if (!src?.subjectId) return;
    // Keep the saved component breakdown on screen while refreshing.
    setDetails((d) => ({
      ...d,
      [code]: { loading: true, components: d[code]?.components ?? [] },
    }));
    try {
      const res = await fetchSpInternalMarksDetail(
        src.subjectId,
        src.status || '',
        src.code || '',
        src.description || ''
      );
      setDetails((d) => ({
        ...d,
        [code]: { loading: false, components: res.components || [], attempts: res.attempts },
      }));
    } catch (e) {
      // A failed refresh (expired session) must not erase the saved breakdown.
      setDetails((d) => ({
        ...d,
        [code]: {
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load components',
          components: d[code]?.components ?? [],
          attempts: d[code]?.attempts,
        },
      }));
    }
  }, [spRows]);

  // A subject is drillable when the Student Portal gave us its id. This works
  // on the website too — the backend proxies the portal request for both the
  // APK and the web app.
  const canViewDetail = (code: string) => !!spRows[code]?.subjectId;

  const openDetail = (code: string) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
    // Refresh from the portal when it is reachable; the saved breakdown stays
    // visible until (and unless) fresh components arrive.
    if (spRows[code]?.subjectId) void loadDetail(code);
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

  const gradeCounts = GRADES.map((g) => ({
    g,
    n: marks.filter((m) => {
      const p = subjectPct(m);
      return p !== null && gradeFor(p / 100) === g;
    }).length,
  }));
  const gradeMax = Math.max(1, ...gradeCounts.map((x) => x.n));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ marginBottom: '24px' }}
    >
      {/* Saved marks are being shown because the portal answer was empty. */}
      {stale && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '12px',
          background: 'rgba(234, 179, 8, 0.06)',
          border: '1px solid rgba(234, 179, 8, 0.16)',
          marginBottom: '10px',
        }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#fcd34d' }}>
            Showing your saved marks — the portal did not return fresh data this time.
          </p>
        </div>
      )}

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

      {/* ── Analysis charts (Internal Marks page only) ── */}
      {charts && (
        <>
          {/* Marks overview — animated donut (overall + per-subject focus) */}
          <MarksDonut
            marks={sorted}
            overallScored={totals.scored}
            overallMax={totals.maxMark}
            overallPct={overallPct}
            W={W}
            WB={WB}
          />

          {/* Grade distribution */}
          <div
            className="thr-gradient-border"
            style={{
              padding: '16px 18px',
              borderRadius: '16px',
              background: 'var(--threshold-surface)',
              border: `1px solid ${WB(0.06)}`,
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: W(0.45), letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Grade distribution
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginTop: '12px' }}>
              {gradeCounts.map(({ g, n }, gi) => (
                <div key={g} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.55rem', color: W(0.45), fontVariantNumeric: 'tabular-nums', height: '12px' }}>{n || ''}</span>
                  <div style={{ width: '100%', height: '46px', display: 'flex', alignItems: 'flex-end' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(n / gradeMax) * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.1 + gi * 0.05, ease: 'easeOut' }}
                      style={{ width: '100%', minHeight: n ? '4px' : '0px', borderRadius: '4px 4px 2px 2px', background: gradeColor(g) }}
                    />
                  </div>
                  <span style={{ fontSize: '0.55rem', fontWeight: 700, color: W(0.5) }}>{g}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Per-Subject Cards ── */}
      <div className="thr-card-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {marks.map((m, i) => {
          const pct = subjectPct(m);
          const color = pctColor(pct);
          const att = subjects.find((s) => s.courseCode === m.code);
          const isExpanded = expanded[m.code] ?? (charts ? m.tests.length > 0 : m.tests.length > 0 && m.tests.length <= 5);
          const detail = details[m.code];

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
                  } else if (canViewDetail(m.code)) {
                    e.stopPropagation();
                    openDetail(m.code);
                  }
                }}
                style={{
                  padding: '14px 16px',
                  cursor: m.tests.length > 0 || canViewDetail(m.code) ? 'pointer' : 'default',
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
                    {m.tests.length === 0 && canViewDetail(m.code) && (
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '5px',
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        background: 'rgba(96,165,250,0.14)',
                        color: '#60a5fa',
                      }}>
                        View Details
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
                  </div>
                </div>
                {(m.tests.length > 0 || canViewDetail(m.code)) && (
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
                  {charts && (
                    <div style={{ margin: '0 0 12px' }}>
                      <ComponentGraph
                        points={m.tests.map((t) => ({
                          label: t.test,
                          scored: parseFloat(t.marks.scored) || 0,
                          max: parseFloat(t.marks.total) || 0,
                          weightage: t.weightage,
                        }))}
                        accent={color}
                        W={W}
                        WB={WB}
                      />
                    </div>
                  )}
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
                              {t.percentage && (
                                <span style={{ fontSize: '0.55rem', color: W(0.35) }}>
                                  {fmtPct(t.percentage)}%
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

                  {/* Subject total — mirrors the Total row on Campus Web */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: `1px dashed ${WB(0.1)}`,
                    }}
                  >
                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      color: W(0.45),
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                    }}>
                      Total
                    </span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color }}>
                        {m.scored.toFixed(1)}
                        <span style={{ color: W(0.3), fontWeight: 400, fontSize: '0.68rem' }}> / {m.maxMark.toFixed(0)}</span>
                      </span>
                      {pct !== null && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color }}>
                          {pct.toFixed(1)}%
                        </span>
                      )}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* SP component split — "View Details" */}
              {m.tests.length === 0 && canViewDetail(m.code) && isExpanded && (
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
                  {!detail || (detail.loading && detail.components.length === 0) ? (
                    <p style={{ fontSize: '0.68rem', color: W(0.4), margin: 0 }}>
                      Loading components…
                    </p>
                  ) : detail.components.length === 0 && detail.error ? (
                    <p style={{ fontSize: '0.68rem', color: '#f87171', margin: 0 }}>
                      {detail.error}
                    </p>
                  ) : detail.components.length === 0 ? (
                    <div>
                      <p style={{ fontSize: '0.68rem', color: W(0.4), margin: 0 }}>
                        No component marks published yet.
                      </p>
                      {detail.attempts && detail.attempts.length > 0 && (
                        <p style={{ fontSize: '0.55rem', color: W(0.25), margin: '6px 0 0', lineHeight: 1.5 }}>
                          {detail.attempts.join(' · ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <p style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: W(0.35),
                        margin: '0 0 8px',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                      }}>
                        Components · Student Portal
                      </p>
                      {charts && (
                        <div style={{ margin: '0 0 12px' }}>
                          <ComponentGraph
                            points={detail.components.map((c) => ({
                              label: c.component,
                              scored: parseFloat(c.scored) || 0,
                              max: parseFloat(c.maxMark) || 0,
                            }))}
                            accent={color}
                            W={W}
                            WB={WB}
                          />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {detail.components.map((c, ci) => {
                          const s = parseFloat(c.scored) || 0;
                          const mx = parseFloat(c.maxMark) || 0;
                          const tp = mx > 0 ? (s / mx) * 100 : 0;
                          const tc = pctColor(tp);
                          return (
                            <div key={`${c.component}-${ci}`}>
                              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  color: W(0.5),
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                  minWidth: 0,
                                }}>
                                  {c.component}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
                                  {c.enteredOn && (
                                    <span style={{ fontSize: '0.55rem', color: W(0.3) }}>
                                      {c.enteredOn}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tc }}>
                                    {s}
                                    <span style={{ color: W(0.3), fontWeight: 400, fontSize: '0.65rem' }}>/{mx}</span>
                                  </span>
                                </span>
                              </div>
                              <div style={{ height: '5px', borderRadius: '3px', background: WB(0.06), overflow: 'hidden' }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${tp}%` }}
                                  transition={{ duration: 0.6, delay: 0.1 + ci * 0.05 }}
                                  style={{ height: '100%', borderRadius: '3px', background: tc }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total row — mirrors the portal's Total */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: '8px',
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: `1px dashed ${WB(0.1)}`,
                        }}
                      >
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 800,
                          color: W(0.45),
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                        }}>
                          Total
                        </span>
                        <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color }}>
                            {detail.components
                              .reduce((sum, c) => sum + (parseFloat(c.scored) || 0), 0)
                              .toFixed(1)}
                            <span style={{ color: W(0.3), fontWeight: 400, fontSize: '0.68rem' }}>
                              {' / '}
                              {detail.components
                                .reduce((sum, c) => sum + (parseFloat(c.maxMark) || 0), 0)
                                .toFixed(0)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Footer hint */}
      {/* Only nag about Academia when no component breakdown is available at
          all — Campus Web logins already get one from /api/auth/user/. */}
      {!academiaOn && marks.every((m) => m.tests.length === 0) && (
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
