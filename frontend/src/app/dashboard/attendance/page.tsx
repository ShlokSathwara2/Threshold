"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn, fetchTimetable, fetchCalendar } from '@/lib/api';
import { useAttendance } from '@/hooks/useAttendance';
import AttendanceSummary from '@/components/attendance/AttendanceSummary';
import SubjectAttendanceCard from '@/components/attendance/SubjectAttendanceCard';
import LeavePlanner from '@/components/attendance/LeavePlanner';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import {
  buildDayOrderSchedule,
  buildDayOrderLookup,
  computeReachPlan,
  computeLeaveImpact,
  projectSubject,
  toDateStr,
  displayDate,
  type DayOrderSchedule,
  type ReachPlan,
  type LeaveProjection,
} from '@/lib/day-order';

export default function AttendancePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const { subjects, overall, loading, error, refetch } = useAttendance();
  const [scheduleByCourse, setScheduleByCourse] = useState<DayOrderSchedule>(new Map());
  const [dayOrderLookup, setDayOrderLookup] = useState<Map<string, string | null>>(new Map());
  const [metaReady, setMetaReady] = useState(false);
  const [leaveDates, setLeaveDates] = useState<string[] | null>(null);

  const fetchMeta = useCallback(async () => {
    try {
      const [tt, cal] = await Promise.all([fetchTimetable(), fetchCalendar()]);
      setScheduleByCourse(buildDayOrderSchedule(tt.schedule || []));
      setDayOrderLookup(buildDayOrderLookup(cal.calendar || []));
    } catch {
      /* features degrade gracefully below */
    } finally {
      setMetaReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
    }
    fetchMeta();
  }, [router, fetchMeta]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), fetchMeta()]);
  }, [refetch, fetchMeta]);
  usePullToRefresh(handleRefresh);

  const todayStr = useMemo(() => toDateStr(new Date()), []);

  // Deep-link highlight: ?code=CSE-101 scrolls to and rings the subject card
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    if (subjects.length === 0) return;
    const q = new URLSearchParams(window.location.search).get('code');
    if (!q) return;
    const code = subjects.find((s) => s.courseCode.toLowerCase() === q.toLowerCase())?.courseCode;
    if (!code) return;
    setTarget(code);
    const el = document.getElementById(`subject-${code}`);
    if (el) {
      window.setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      window.setTimeout(() => setTarget(null), 4000);
    }
  }, [subjects]);

  const reachPlans = useMemo(() => {
    const plans = new Map<string, ReachPlan | null>();
    for (const s of subjects) {
      plans.set(
        s.courseCode,
        s.isBelowThreshold
          ? computeReachPlan(s, scheduleByCourse, dayOrderLookup, todayStr)
          : null
      );
    }
    return plans;
  }, [subjects, scheduleByCourse, dayOrderLookup, todayStr]);

  const projection = useMemo(() => {
    if (!leaveDates) return null;
    const { from, to, perSubject } = computeLeaveImpact(
      scheduleByCourse,
      dayOrderLookup,
      leaveDates,
      todayStr
    );
    const projected = new Map<string, LeaveProjection>();
    let missedTotal = 0;
    let subjectsDropping = 0;
    for (const s of subjects) {
      const { missed, attendedBefore } = perSubject.get(s.courseCode) ?? { missed: 0, attendedBefore: 0 };
      missedTotal += missed;
      const p = projectSubject(s, missed, attendedBefore);
      projected.set(s.courseCode, p);
      if (missed > 0 && p.dropsBelow75) subjectsDropping += 1;
    }
    return {
      leaveDays: leaveDates.length,
      leaveFrom: from,
      leaveTo: to,
      missedTotal,
      subjectsDropping,
      perSubject: projected,
    };
  }, [leaveDates, subjects, scheduleByCourse, dayOrderLookup, todayStr]);

  // Overall projected present/absent/total + margin across all subjects,
  // so the leave planner summary shows the whole-picture effect.
  const overallProjection = useMemo(() => {
    if (!projection) return null;
    let present = 0;
    let absent = 0;
    let total = 0;
    for (const s of subjects) {
      const p = projection.perSubject.get(s.courseCode);
      if (p) {
        present += p.projectedPresent;
        absent += p.projectedAbsent;
        total += p.projectedTotal;
      } else {
        present += s.present;
        absent += s.absent;
        total += s.total;
      }
    }
    const percentage = total > 0 ? (present / total) * 100 : 0;
    let canBunk = 0;
    let mustAttend = 0;
    if (percentage >= 75) {
      canBunk = Math.floor((present - 0.75 * total) / 0.75);
    } else {
      mustAttend = Math.ceil((0.75 * total - present) / 0.25);
    }
    return {
      present,
      absent,
      total,
      percentage,
      margin: percentage - 75,
      canBunk,
      mustAttend,
      below75: percentage < 75,
    };
  }, [projection, subjects]);

  const belowThreshold = subjects.filter((s) => s.isBelowThreshold);
  const hasMeta = metaReady && scheduleByCourse.size > 0 && dayOrderLookup.size > 0;

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        gap: '16px',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(139, 92, 246, 0.2)',
            borderTopColor: 'var(--threshold-accent)',
            borderRadius: '50%',
          }}
        />
        <p style={{ color: W(0.4), fontSize: '0.85rem' }}>
          Fetching attendance data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        gap: '16px',
        padding: '20px',
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: '12px' }}>
            {error}
          </p>
          <button
            onClick={refetch}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--threshold-accent-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px' }}
      >
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'var(--threshold-text)',
          marginBottom: '4px',
        }}>
          Attendance
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          {subjects.length} subjects tracked • Sorted by risk (lowest margin first)
        </p>
      </motion.div>

      {/* Overall Summary */}
      <AttendanceSummary stats={overall} />

      {/* Leave planner */}
      <LeavePlanner
        onApply={(dates) => setLeaveDates(dates)}
        onReset={() => setLeaveDates(null)}
        active={leaveDates !== null}
        leaveDays={projection?.leaveDays ?? 0}
        leaveFrom={projection?.leaveFrom ?? null}
        leaveTo={projection?.leaveTo ?? null}
        missedTotal={projection?.missedTotal ?? 0}
        subjectsDropping={projection?.subjectsDropping ?? 0}
        overall={overallProjection}
      />

      {/* 75% Recovery Plan */}
      {belowThreshold.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            borderRadius: '14px',
            background: WB(0.02),
            border: `1px solid ${WB(0.07)}`,
            marginBottom: '14px',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${WB(0.05)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
              75% Recovery Plan
            </h2>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.4px',
              color: 'rgba(234, 179, 8, 0.9)',
              padding: '3px 8px',
              borderRadius: '999px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
            }}>
              {belowThreshold.length} AT RISK
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {belowThreshold.map((s, i) => {
              const plan = reachPlans.get(s.courseCode) ?? null;
              return (
                <div key={s.courseCode} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderBottom: i < belowThreshold.length - 1 ? `1px solid ${WB(0.04)}` : 'none',
                }}>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    color: '#f97316',
                    background: 'rgba(249,115,22,0.12)',
                    padding: '2px 7px',
                    borderRadius: '6px',
                  }}>
                    {s.courseCode}
                  </span>
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '0.72rem',
                    color: W(0.55),
                    lineHeight: 1.4,
                  }}>
                    {plan && plan.hasSchedule && plan.reachable ? (
                      <>
                        Attend every class till{' '}
                        <span style={{ fontWeight: 800, color: '#fbbf24' }}>{displayDate(plan.reachDate!)}</span>{' '}
                        — {plan.needed} classes needed
                      </>
                    ) : plan && plan.hasSchedule ? (
                      <>
                        Can't reach 75% — only{' '}
                        <span style={{ fontWeight: 800, color: '#f87171' }}>{plan.futureClasses}</span> classes left
                      </>
                    ) : (
                      'No timetable data to estimate a date'
                    )}
                  </span>
                </div>
              );
            })}
            {!hasMeta && (
              <p style={{
                margin: 0,
                padding: '10px 14px',
                fontSize: '0.68rem',
                color: W(0.35),
                borderTop: `1px solid ${WB(0.04)}`,
              }}>
                Timetable/planner data unavailable — dates are estimates only when data loads.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Subject Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {subjects.map((subject, i) => (
          <div
            key={subject.courseCode}
            id={`subject-${subject.courseCode}`}
            style={target === subject.courseCode ? {
              borderRadius: '18px',
              boxShadow: '0 0 0 3px rgba(139,92,246,0.8), 0 0 24px rgba(139,92,246,0.4)',
              transition: 'box-shadow 0.4s',
            } : undefined}
          >
            <SubjectAttendanceCard
              subject={subject}
              index={i}
              dayOrders={scheduleByCourse.get(subject.courseCode)}
              reachPlan={reachPlans.get(subject.courseCode) ?? null}
              projection={projection?.perSubject.get(subject.courseCode) ?? null}
            />
          </div>
        ))}
      </div>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          onClick={handleRefresh}
          style={{
            padding: '10px 28px',
            borderRadius: '10px',
            border: '1px solid var(--threshold-border)',
            background: 'var(--threshold-surface)',
            color: W(0.4),
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}