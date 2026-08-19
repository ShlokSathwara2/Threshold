"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn, fetchTimetable, fetchCalendar, type TimetableSlot } from '@/lib/api';
import { useAttendance } from '@/hooks/useAttendance';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { computeHabitInsights, recordAttendanceSnapshot } from '@/lib/habits';
import { toDateStr } from '@/lib/day-order';

export default function InsightsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const { subjects, loading, error, refetch } = useAttendance();
  const [schedule, setSchedule] = useState<TimetableSlot[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
    }
  }, [router]);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [tt, cal] = await Promise.all([fetchTimetable(), fetchCalendar()]);
      setSchedule(tt.schedule || []);
      setScheduleError(null);
      const m = cal.today?.dayOrder?.match(/Day\s*(\d)/i);
      const doName = m && +m[1] >= 1 && +m[1] <= 5 ? `DO-${m[1]}` : null;
      recordAttendanceSnapshot(subjects, toDateStr(new Date()), doName);
    } catch {
      setScheduleError('Timetable unavailable — day patterns will be empty.');
    } finally {
      setLoadingMeta(false);
    }
  }, [subjects]);

  useEffect(() => {
    if (subjects.length > 0) loadMeta();
  }, [subjects, loadMeta]);

  const refresh = useCallback(async () => {
    await Promise.all([refetch(), loadMeta()]);
  }, [refetch, loadMeta]);
  usePullToRefresh(refresh);

  const insights = useMemo(() => computeHabitInsights(subjects, schedule), [subjects, schedule]);

  if (loading) return <LoadingState label="Fetching attendance data…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const maxAbsent = Math.max(1, ...insights.mostMissed.map((s) => s.absent));
  const maxSkips = Math.max(1, ...insights.tracked.map((t) => t.skips));

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--threshold-text)', marginBottom: '4px' }}>
          Insights
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Factual patterns from your attendance — no guilt, just data
        </p>
      </motion.div>

      {/* ── Most-missed subjects ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          borderRadius: '16px',
          border: `1px solid ${WB(0.07)}`,
          background: WB(0.02),
          marginBottom: '14px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 14px',
          borderBottom: `1px solid ${WB(0.05)}`,
        }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
            Most-missed subjects
          </h2>
          <span style={{ color: '#f97316', fontSize: '0.9rem' }}>📉</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px' }}>
          {insights.mostMissed.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.75rem', color: W(0.45) }}>
              No attendance records yet — pull to refresh.
            </p>
          ) : (
            insights.mostMissed.map((s) => (
              <div key={s.courseCode}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: W(0.6),
                  }}>
                    {s.courseCode}
                  </span>
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '0.72rem',
                    color: W(0.5),
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.courseTitle}
                  </span>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: s.absent >= 5 ? '#f87171' : '#fbbf24',
                  }}>
                    {s.absent} missed
                  </span>
                </div>
                <div style={{
                  height: '6px',
                  borderRadius: '999px',
                  background: WB(0.05),
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(s.absent / maxAbsent) * 100}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #f97316, #fb923c)',
                  }} />
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* ── Heaviest days ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{
          borderRadius: '16px',
          border: `1px solid ${WB(0.07)}`,
          background: WB(0.02),
          marginBottom: '14px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 14px',
          borderBottom: `1px solid ${WB(0.05)}`,
        }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
            Heaviest class days
          </h2>
          <span style={{ color: '#60a5fa', fontSize: '0.9rem' }}>📅</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px' }}>
          {insights.dayLoad.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.75rem', color: W(0.45) }}>
              No timetable data{scheduleError ? ` — ${scheduleError}` : ''}
            </p>
          ) : (
            insights.dayLoad.map((d) => (
              <div key={d.day} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <span style={{
                  flexShrink: 0,
                  width: '44px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: W(0.65),
                }}>
                  {d.day}
                </span>
                <div style={{
                  flex: 1,
                  height: '8px',
                  borderRadius: '999px',
                  background: WB(0.05),
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(d.classes / Math.max(1, insights.dayLoad[0].classes)) * 100}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                  }} />
                </div>
                <span style={{
                  flexShrink: 0,
                  width: '64px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: W(0.5),
                  textAlign: 'right',
                }}>
                  {d.classes} classes
                </span>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* ── Tracked skip pattern ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        style={{
          borderRadius: '16px',
          border: `1px solid ${WB(0.07)}`,
          background: WB(0.02),
          marginBottom: '14px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 14px',
          borderBottom: `1px solid ${WB(0.05)}`,
        }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
            Days you skip most
          </h2>
          <span style={{ color: '#e879f9', fontSize: '0.9rem' }}>🧭</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px' }}>
          {insights.tracked.length === 0 ? (
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: W(0.45), lineHeight: 1.5 }}>
                {insights.totalTracked === 0
                  ? 'No skips detected yet — this pattern builds automatically as you use the app.'
                  : 'No day-order pattern yet — keep the app open on class days.'}
              </p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: W(0.3), lineHeight: 1.5 }}>
                Each day you open the app, your attendance is compared to the last snapshot.
                Any new misses are attributed to that day&apos;s order (DO-1…DO-5).
              </p>
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: W(0.45) }}>
                {insights.totalTracked} class{insights.totalTracked === 1 ? '' : 'es'} skipped in tracked days
              </p>
              {insights.tracked.map((t) => (
                <div key={t.dayOrder} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <span style={{
                    flexShrink: 0,
                    width: '44px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: W(0.65),
                  }}>
                    {t.dayOrder}
                  </span>
                  <div style={{
                    flex: 1,
                    height: '8px',
                    borderRadius: '999px',
                    background: WB(0.05),
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(t.skips / maxSkips) * 100}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, #d946ef, #e879f9)',
                    }} />
                  </div>
                  <span style={{
                    flexShrink: 0,
                    width: '64px',
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    color: W(0.5),
                    textAlign: 'right',
                  }}>
                    {t.skips} skip{t.skips === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </motion.div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
        <button
          onClick={refresh}
          disabled={loading || loadingMeta}
          style={{
            padding: '10px 28px',
            borderRadius: '10px',
            border: '1px solid var(--threshold-border)',
            background: 'var(--threshold-surface)',
            color: W(0.4),
            fontSize: '0.8rem',
            cursor: loading || loadingMeta ? 'wait' : 'pointer',
          }}
        >
          {loading || loadingMeta ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
    </div>
  );
}