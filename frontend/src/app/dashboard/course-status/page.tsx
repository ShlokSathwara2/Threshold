"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isSpLoggedIn,
  fetchSpCourseStatus,
  type CourseStatusResponse,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';

const gradeColors: Record<string, string> = {
  O: '#34d399',
  'A+': '#6ee7b7',
  A: '#a3e635',
  'B+': '#facc15',
  B: '#fb923c',
  C: '#f87171',
  D: '#f87171',
  F: '#ef4444',
};

export default function CourseStatusPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [data, setData] = useState<CourseStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpCourseStatus();
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load course status');
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

  const courses = data?.courses || [];
  const categories = data?.category_summary || [];
  const semWise = data?.semester_wise || [];
  const completed = courses.filter((c) => c.grade && c.grade !== '-').length;

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
          Course Status
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Course completion across all semesters • Student Portal
        </p>
      </motion.div>

      {loading ? (
        <LoadingState label="Fetching course status…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : courses.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No course data yet"
          hint="Your registered courses will appear here once the portal publishes them."
          onRefresh={load}
        />
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '16px',
          }}>
            {[
              { label: 'Courses', value: String(courses.length) },
              { label: 'Completed', value: String(completed) },
              { label: 'Categories', value: String(categories.length) },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '14px 8px',
                borderRadius: '14px',
                background: WB(0.02),
                border: `1px solid ${WB(0.06)}`,
                textAlign: 'center',
              }}>
                <p style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: 'var(--threshold-accent-text)',
                  lineHeight: 1,
                }}>
                  {s.value}
                </p>
                <p style={{
                  fontSize: '0.62rem',
                  color: W(0.4),
                  marginTop: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {categories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: '18px',
                background: WB(0.02),
                border: `1px solid ${WB(0.06)}`,
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <p style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--threshold-text)',
                marginBottom: '12px',
              }}>
                Category-wise completion
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {categories.map((c) => {
                  const req = parseFloat(c.required);
                  const got = parseFloat(c.acquired);
                  const pct = !isNaN(req) && req > 0 && !isNaN(got) ? (got / req) * 100 : null;
                  return (
                    <div key={c.category}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.72rem',
                        marginBottom: '4px',
                      }}>
                        <span style={{ color: W(0.55), fontWeight: 600 }}>{c.category}</span>
                        <span style={{ color: W(0.45) }}>
                          {c.acquired} / {c.required} credits
                        </span>
                      </div>
                      <div style={{
                        height: '7px',
                        borderRadius: '999px',
                        background: WB(0.06),
                        overflow: 'hidden',
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct === null ? 0 : Math.min(100, pct)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          style={{
                            height: '100%',
                            borderRadius: '999px',
                            background: 'linear-gradient(90deg, var(--threshold-accent), #d946ef)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {semWise.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              style={{
                borderRadius: '18px',
                background: WB(0.02),
                border: `1px solid ${WB(0.06)}`,
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <p style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--threshold-text)',
                marginBottom: '12px',
              }}>
                Semester-wise credits
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {semWise.map((s) => {
                  const req = parseFloat(s.required);
                  const got = parseFloat(s.acquired);
                  const pct = !isNaN(req) && req > 0 && !isNaN(got) ? (got / req) * 100 : null;
                  return (
                    <div key={`${s.semester}-${s.category}`}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.72rem',
                        marginBottom: '4px',
                      }}>
                        <span style={{ color: W(0.55), fontWeight: 600 }}>
                          Sem {s.semester} · {s.category}
                        </span>
                        <span style={{ color: W(0.45) }}>
                          {s.acquired} / {s.required}
                        </span>
                      </div>
                      <div style={{
                        height: '6px',
                        borderRadius: '999px',
                        background: WB(0.06),
                        overflow: 'hidden',
                      }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct === null ? 0 : Math.min(100, pct)}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          style={{
                            height: '100%',
                            borderRadius: '999px',
                            background: W(0.35),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              borderRadius: '18px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 16px 0' }}>
              <p style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--threshold-text)',
              }}>
                All courses
              </p>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.72rem',
                minWidth: '560px',
              }}>
                <thead>
                  <tr>
                    {['Category', 'Code', 'Description', 'Credit', 'Grade', 'Completed', 'Attempts'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left',
                        padding: '12px 12px 8px',
                        color: W(0.35),
                        fontWeight: 600,
                        fontSize: '0.62rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap',
                        borderBottom: `1px solid ${WB(0.06)}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c, i) => {
                    const gc = gradeColors[c.grade];
                    return (
                      <motion.tr
                        key={`${c.code}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(0.02 * i, 0.6) }}
                        style={{
                          borderBottom: `1px solid ${WB(0.04)}`,
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>
                          {c.category}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--threshold-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {c.code}
                        </td>
                        <td style={{ padding: '10px 12px', color: W(0.6) }}>
                          {c.description}
                        </td>
                        <td style={{ padding: '10px 12px', color: W(0.45), textAlign: 'center' }}>
                          {c.credit}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            minWidth: '30px',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            color: gc || W(0.45),
                            background: gc ? `${gc}1a` : WB(0.04),
                            border: `1px solid ${gc ? `${gc}40` : WB(0.08)}`,
                          }}>
                            {c.grade}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>
                          {c.completed}
                        </td>
                        <td style={{ padding: '10px 12px', color: W(0.45), textAlign: 'center' }}>
                          {c.attempts || '—'}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

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