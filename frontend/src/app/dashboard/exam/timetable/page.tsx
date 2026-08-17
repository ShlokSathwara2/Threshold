"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isSpLoggedIn,
  fetchSpExamTimetable,
  type ExamTimetableResponse,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';

export default function ExamTimetablePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [data, setData] = useState<ExamTimetableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpExamTimetable();
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load exam timetable');
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

  const rows = data?.rows || [];

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
          Exam Timetable
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Your exam schedule from the Student Portal
        </p>
      </motion.div>

      {loading ? (
        <LoadingState label="Fetching exam timetable…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data?.available || rows.length === 0 ? (
        <EmptyState
          icon="▧"
          title="No exams scheduled yet"
          hint="Your exam timetable will appear here once the university publishes it."
          onRefresh={load}
        />
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '16px',
          }}>
            {[
              { label: 'Subjects', value: String(rows.length) },
              {
                label: 'Upcoming',
                value: String(rows.filter((r) => {
                  const raw = r.date_session || '';
                  const m = raw.match(/(\d{2})-(\w{3})-(\d{4})/);
                  if (!m) return true;
                  const months: Record<string, number> = {
                    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
                    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
                  };
                  const d = new Date(Number(m[3]), months[m[2].toUpperCase()] ?? 0, Number(m[1]));
                  return d.getTime() >= Date.now() - 86400000;
                }).length),
              },
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

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              borderRadius: '18px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.72rem',
                minWidth: '560px',
              }}>
                <thead>
                  <tr>
                    {['Sem', 'Code', 'Subject', 'Date & Session', 'Hall', 'Seat'].map((h) => (
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
                  {rows.map((r, i) => (
                    <motion.tr
                      key={`${r.subject_code}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(0.03 * i, 0.5) }}
                      style={{ borderBottom: `1px solid ${WB(0.04)}` }}
                    >
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>
                        {r.sem_year_trim || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--threshold-text)', whiteSpace: 'nowrap' }}>
                        {r.subject_code}
                      </td>
                      <td style={{ padding: '10px 12px', color: W(0.6) }}>
                        {r.subject_description || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>
                        {r.date_session || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>
                        {r.hall_no || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>
                        {r.seat_no || '—'}
                      </td>
                    </motion.tr>
                  ))}
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