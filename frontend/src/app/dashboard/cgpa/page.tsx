﻿"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isSpLoggedIn, fetchCourses, type Mark } from '@/lib/api';
import { useSubjectMarks } from '@/hooks/useSubjectMarks';
import { GRADE_POINTS, computeSgpa, type CgpaRow } from '@/lib/grade-calculator';
import GradeTargetTool from '@/components/marks/GradeTargetTool';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

const GRADE_OPTIONS = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'];

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `row-${Date.now()}-${idCounter}`;
}

function blankRow(name = ''): CgpaRow {
  return { id: newId(), name, credits: 3, grade: 'A' };
}

function SectionHeader({ color, title, subtitle }: { color: string; title: string; subtitle: string }) {
  return (
    <div style={{ margin: '24px 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ width: '4px', height: '16px', borderRadius: '2px', background: color }} />
        <h2 style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.75)',
        }}>
          {title}
        </h2>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', lineHeight: 1.5 }}>
        {subtitle}
      </p>
    </div>
  );
}

export default function CgpaCalculatorPage() {
  const router = useRouter();
  const { marks, loading: marksLoading, error: marksError, semester, refetch: refetchMarks } = useSubjectMarks();
  usePullToRefresh(refetchMarks);

  const [rows, setRows] = useState<CgpaRow[]>([]);
  const [history, setHistory] = useState<CgpaRow[][]>([]);
  const [seeded, setSeeded] = useState(false);
  const [creditMap, setCreditMap] = useState<Map<string, number>>(new Map());
  const [creditsSettled, setCreditsSettled] = useState(false);
  const initialRef = useRef<CgpaRow[] | null>(null);

  useEffect(() => {
    if (!isSpLoggedIn()) {
      router.push('/sp-login');
    }
  }, [router]);

  // Best-effort real credits from academia /courses (falls back to 3)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await Promise.race([
          fetchCourses(),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 4000)),
        ]);
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const c of res.courses || []) {
          const n = parseFloat(c.credit);
          if (!isNaN(n) && n > 0) map.set(c.code, n);
        }
        if (map.size > 0) setCreditMap(map);
      } catch {
        // academia unavailable — keep default credits
      } finally {
        if (!cancelled) setCreditsSettled(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const creditFor = useCallback((code: string): number => {
    const c = creditMap.get(code);
    return c && c > 0 ? c : 3;
  }, [creditMap]);

  // Seed only from CURRENT semester subjects (past semesters are already graded)
  useEffect(() => {
    if (seeded || !creditsSettled) return;
    if (marks.length > 0) {
      const pulled: CgpaRow[] = marks.map((m: Mark) => ({
        id: newId(),
        name: m.courseName,
        credits: creditFor(m.courseCode),
        grade: 'A',
        courseCode: m.courseCode,
      }));
      setRows(pulled);
      initialRef.current = pulled;
      setSeeded(true);
      return;
    }
    if (!marksLoading) {
      const blank = [blankRow()];
      setRows(blank);
      initialRef.current = blank;
      setSeeded(true);
    }
  }, [marks, marksLoading, seeded, creditsSettled, creditFor]);

  // After refresh, append any newly published subjects (never clobber user edits)
  useEffect(() => {
    if (!seeded || marks.length === 0) return;
    setRows((current) => {
      const existing = new Set(current.map((r) => r.courseCode).filter(Boolean));
      const missing = marks.filter((m) => !existing.has(m.courseCode));
      if (missing.length === 0) return current;
      return [
        ...current,
        ...missing.map((m: Mark) => ({
          id: newId(),
          name: m.courseName,
          credits: creditFor(m.courseCode),
          grade: 'A',
          courseCode: m.courseCode,
        })),
      ];
    });
  }, [marks, seeded, creditFor]);

  const commit = useCallback((next: CgpaRow[]) => {
    setHistory((h) => [...h.slice(-29), rows]);
    setRows(next);
  }, [rows]);

  const updateRow = useCallback((id: string, patch: Partial<CgpaRow>) => {
    commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, [rows, commit]);

  const addRow = useCallback(() => {
    commit([...rows, blankRow()]);
  }, [rows, commit]);

  const deleteRow = useCallback((id: string) => {
    if (rows.length <= 1) return;
    commit(rows.filter((r) => r.id !== id));
  }, [rows, commit]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setRows(prev);
      return h.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    const target = initialRef.current && initialRef.current.length > 0
      ? initialRef.current.map((r) => ({ ...r, id: newId() }))
      : [blankRow()];
    setHistory((h) => [...h.slice(-29), rows]);
    setRows(target);
  }, [rows]);

  const { sgpa, totalCredits, totalPoints } = computeSgpa(rows);
  const maxPoints = Math.max(1, ...rows.map((r) => Math.max(0, r.credits || 0) * (GRADE_POINTS[r.grade] ?? 0)));
  const canUndo = history.length > 0;

  const subjectByCode = useRef<Map<string, Mark>>(new Map());
  for (const m of marks) subjectByCode.current.set(m.courseCode, m);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '8px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--threshold-text)', marginBottom: '4px' }}>
          CGPA Calculator
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Two tools: predict your SGPA, then plan your end-sem targets
        </p>
        {typeof semester === 'number' && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            padding: '4px 12px',
            borderRadius: '999px',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--threshold-accent-text)',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--threshold-accent)' }} />
            Current semester · Sem {semester}
          </div>
        )}
      </motion.div>

      {/* ─────────────── CALCULATOR 1: SGPA PREDICTOR ─────────────── */}
      <SectionHeader
        color="var(--threshold-accent)"
        title="1 · SGPA Predictor"
        subtitle="Pick the grade you expect in each current-semester subject — your SGPA recomputes instantly. Only subjects from this semester are listed."
      />

      {/* SGPA Hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          padding: '24px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(139, 92, 246, 0.08))',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          marginBottom: '12px',
          textAlign: 'center',
        }}
      >
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: '6px',
        }}>
          Expected SGPA
        </p>
        <p style={{
          fontSize: '3rem',
          fontWeight: 800,
          lineHeight: 1,
          background: 'linear-gradient(135deg, var(--threshold-accent-text), var(--threshold-accent), #f0abfc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {sgpa.toFixed(3)}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '8px' }}>
          {totalPoints.toFixed(1)} grade points ÷ {totalCredits} credits
        </p>
      </motion.div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={addRow}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '10px',
            border: '1px dashed rgba(139, 92, 246, 0.4)',
            background: 'rgba(139, 92, 246, 0.08)',
            color: 'var(--threshold-accent-text)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add subject
        </button>
        <button
          onClick={undo}
          disabled={!canUndo}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'var(--threshold-surface)',
            color: canUndo ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
            fontSize: '0.8rem',
            cursor: canUndo ? 'pointer' : 'not-allowed',
          }}
        >
          ↶ Undo
        </button>
        <button
          onClick={reset}
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#fca5a5',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>

      {marksLoading && rows.length === 0 && (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            Loading current subjects…
          </p>
        </div>
      )}

      {marksError && rows.length === 0 && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          marginBottom: '12px',
        }}>
          <p style={{ color: '#fca5a5', fontSize: '0.75rem', margin: 0 }}>
            Could not auto-load subjects ({marksError}) — add them manually below.
          </p>
        </div>
      )}

      {/* SGPA rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((row, i) => {
          const gp = GRADE_POINTS[row.grade] ?? 0;
          const points = Math.max(0, row.credits || 0) * gp;
          const impactPct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;

          return (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'var(--threshold-surface)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  placeholder="Subject name"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: '1px solid var(--threshold-border)',
                    background: 'var(--threshold-surface)',
                    color: 'var(--threshold-text)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={1}
                    value={row.credits}
                    onChange={(e) => updateRow(row.id, { credits: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '46px',
                      padding: '8px 6px',
                      borderRadius: '10px',
                      border: '1px solid var(--threshold-border)',
                      background: 'var(--threshold-surface)',
                      color: 'var(--threshold-text)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: 'var(--threshold-text-faint)' }}>cr</span>
                  <button
                    onClick={() => deleteRow(row.id)}
                    disabled={rows.length <= 1}
                    aria-label="Delete subject"
                    style={{
                      marginLeft: '4px',
                      padding: '6px 9px',
                      borderRadius: '8px',
                      border: 'none',
                      background: rows.length <= 1 ? 'var(--threshold-surface)' : 'rgba(239, 68, 68, 0.12)',
                      color: rows.length <= 1 ? 'rgba(255,255,255,0.2)' : '#f87171',
                      fontSize: '0.8rem',
                      cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Expected grade pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '0.68rem',
                  color: 'var(--threshold-text-faint)',
                  marginRight: '4px',
                  flexShrink: 0,
                }}>
                  Expect:
                </span>
                {GRADE_OPTIONS.map((g) => {
                  const active = row.grade === g;
                  return (
                    <button
                      key={g}
                      onClick={() => updateRow(row.id, { grade: g })}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '8px',
                        border: active ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.07)',
                        background: active ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.02)',
                        color: active ? 'var(--threshold-accent-text)' : 'rgba(255,255,255,0.45)',
                        fontSize: '0.72rem',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>

              {/* Credit-weight impact */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '0.72rem',
                  color: 'rgba(255,255,255,0.45)',
                  flexShrink: 0,
                  minWidth: '76px',
                }}>
                  {row.credits || 0} cr × {gp} GP ={' '}
                  <span style={{ color: 'var(--threshold-accent-text)', fontWeight: 700 }}>{points.toFixed(1)}</span>
                </span>
                <div style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <motion.div
                    animate={{ width: `${impactPct}%` }}
                    transition={{ duration: 0.4 }}
                    style={{
                      height: '100%',
                      borderRadius: '2px',
                      background: points > 0 ? 'var(--threshold-accent)' : 'rgba(255,255,255,0.15)',
                    }}
                  />
                </div>
                <span style={{
                  fontSize: '0.66rem',
                  color: 'rgba(255,255,255,0.3)',
                  flexShrink: 0,
                  width: '40px',
                  textAlign: 'right',
                }}>
                  {Math.round(impactPct)}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ─────────────── CALCULATOR 2: GRADE PREDICTOR ─────────────── */}
      <SectionHeader
        color="#22c55e"
        title="2 · Grade Predictor"
        subtitle="For each current-semester subject, see what you must score in the end-sem exam to reach each grade — based on the internal marks already entered in the portal. Past-semester subjects are never listed here."
      />

      {marksLoading ? (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            Loading subject marks…
          </p>
        </div>
      ) : marks.length === 0 ? (
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            No marks entered in the portal yet. Once faculty publish internal marks, targets appear here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {marks.map((m, i) => (
            <motion.div
              key={m.courseCode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                borderRadius: '14px',
                background: 'rgba(34, 197, 94, 0.03)',
                border: '1px solid rgba(34, 197, 94, 0.15)',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#86efac', marginBottom: '2px' }}>
                    {m.courseCode} · {m.courseType}
                  </p>
                  <h3 style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'var(--threshold-text)',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {m.courseName}
                  </h3>
                </div>
                <div style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#86efac',
                }}>
                  {m.overall?.scored || '0'}
                  <span style={{ color: 'var(--threshold-text-faint)', fontWeight: 400, fontSize: '0.72rem' }}>
                    /{m.overall?.total || '0'}
                  </span>
                </div>
              </div>
              <GradeTargetTool subject={m} />
            </motion.div>
          ))}
        </div>
      )}

      <p style={{
        color: 'rgba(255,255,255,0.25)',
        fontSize: '0.72rem',
        textAlign: 'center',
        marginTop: '20px',
      }}>
        Past semesters are already graded — the calculators only cover your current subjects.
      </p>
    </div>
  );
}