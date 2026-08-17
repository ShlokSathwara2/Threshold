"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isSpLoggedIn,
  isAcademiaLoggedIn,
  fetchCalendar,
  fetchTimetable,
  fetchSpProfile,
  fetchSpInternalMarks,
  type CalendarResponse,
  type TimetableResponse,
  type TimetableSlot,
  type SpProfile,
  type InternalMark,
} from '@/lib/api';
import { useAttendance } from '@/hooks/useAttendance';
import { useSubjectRegistry } from '@/lib/subject-registry';
import GradesSummary from '@/components/grades/GradesSummary';
import InternalMarks from '@/components/grades/InternalMarks';
import AcademiaLoginCard from '@/components/academia/AcademiaLoginCard';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function parseClock(t: string | undefined): number | null {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let min = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  // Times arrive as 12-hour strings without AM/PM: hours ≤ 6 are afternoon
  // (e.g. "01:25 - 02:15" = 1:25 PM), 12 is midday, 7–11 are morning.
  if (Math.floor(min / 60) <= 6) min += 12 * 60;
  return min;
}

function slotWindow(s: TimetableSlot): { start: number; end: number } {
  const [fromRaw, toRaw] = (s.time || '').split('-');
  let start = parseClock(fromRaw);
  let end = parseClock(toRaw);
  // Fallback for missing/odd times: hour 1 ≈ 08:00, each hour 50 min
  if (start === null) start = 480 + (s.hour - 1) * 50;
  if (end === null) end = start + 50;
  return { start, end };
}

export default function DashboardPage() {
  const router = useRouter();
  const { subjects, overall, loading, refetch: refetchAttendance } = useAttendance();
  const [gradesKey, setGradesKey] = useState(0);
  const { getSubject } = useSubjectRegistry();
  usePullToRefresh(async () => { await refetchAttendance(); setGradesKey((k) => k + 1); });

  const [profile, setProfile] = useState<SpProfile | null>(null);
  const [todayDO, setTodayDO] = useState<string | null>(null);
  const [todayClasses, setTodayClasses] = useState<TimetableSlot[] | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [internalMarks, setInternalMarks] = useState<InternalMark[] | null>(null);
  const [academiaKey, setAcademiaKey] = useState(0);

  const loadTimetable = async () => {
    if (!isAcademiaLoggedIn()) return;
    try {
      const tt: TimetableResponse = await fetchTimetable();
      setTodayClasses(tt.schedule?.length ? tt.schedule : null);
    } catch {
      setTodayClasses(null);
    }
  };

  const handleAcademiaLogin = () => {
    setAcademiaKey((k) => k + 1);
    loadTimetable();
  };

  useEffect(() => {
    if (!isSpLoggedIn()) {
      router.push('/sp-login');
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchSpProfile();
        if (!cancelled && p.profile) setProfile(p.profile);
      } catch {
        /* ignore */
      }
      try {
        const cal: CalendarResponse = await fetchCalendar();
        if (!cancelled) setCalendar(cal);
        if (!cancelled && !cal.error && cal.today) {
          const m = cal.today.dayOrder?.match(/Day\s*(\d)/i);
          setTodayDO(m ? `DO-${m[1]}` : null);
          setCalError(null);
        } else {
          setTodayDO(null);
          setCalError(cal?.error ? (cal.message || 'Calendar unavailable') : null);
        }
      } catch {
        if (!cancelled) {
          setTodayDO(null);
          setCalError(null);
        }
      }
      try {
        const im = await fetchSpInternalMarks();
        if (!cancelled) setInternalMarks(im.internal_marks?.length ? im.internal_marks : null);
      } catch {
        if (!cancelled) setInternalMarks(null);
      }
      if (!isAcademiaLoggedIn()) {
        setTodayClasses(null);
        return;
      }
      try {
        const tt: TimetableResponse = await fetchTimetable();
        if (!cancelled) {
          setTodayClasses(tt.schedule?.length ? tt.schedule : null);
        }
      } catch {
        if (!cancelled) setTodayClasses(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const firstName = profile?.name?.split(' ')[0] || 'Student';
  const todaysSlots = todayClasses
    ? todayClasses
        .filter((s) => todayDO && s.day === todayDO)
        .sort((a, b) => a.hour - b.hour)
    : [];

  // Timeline geometry: classes positioned between day start and day end
  const dayStart = todaysSlots.length ? Math.min(...todaysSlots.map((s) => slotWindow(s).start)) : 0;
  const dayEnd = todaysSlots.length ? Math.max(...todaysSlots.map((s) => slotWindow(s).end)) : 0;
  const span = dayEnd - dayStart;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const progress = span > 0 ? Math.min(1, Math.max(0, (nowMin - dayStart) / span)) : 0;
  const positionPct = (s: TimetableSlot) =>
    span > 0 ? Math.min(100, Math.max(0, ((slotWindow(s).start - dayStart) / span) * 100)) : 0;
  const fmtTime = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const hh = ((h + 11) % 12) + 1;
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${hh}:${m.toString().padStart(2, '0')} ${ap}`;
  };

  const overallColor = overall.overallPercentage >= 85 ? '#22c55e'
    : overall.overallPercentage >= 75 ? '#eab308'
    : overall.overallPercentage >= 60 ? '#f97316'
    : '#ef4444';

  const atRisk = subjects.filter((s) => s.isBelowThreshold);

  // ── Alerts: upcoming holidays from the academic calendar ──
  const upcomingHolidays = (() => {
    if (!calendar || calendar.error || !calendar.calendar) return [];
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    const found: { date: Date; label: string }[] = [];
    for (const month of calendar.calendar) {
      for (const d of month.days) {
        if (!/holiday/i.test(d.event || '')) continue;
        const m = d.date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (!m) continue;
        const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        const diff = Math.round((dt.getTime() - todayD.getTime()) / 86400000);
        if (diff >= 0 && diff <= 10) found.push({ date: dt, label: d.event || 'Holiday' });
      }
    }
    return found.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
  })();

  const holidayToday = upcomingHolidays.some((h) => h.date.getTime() === new Date().setHours(0, 0, 0, 0));

  // ── Current / next class ──
  const currentClass = todaysSlots.find((s) => {
    const w = slotWindow(s);
    return nowMin >= w.start && nowMin < w.end;
  });
  const nextClass = todaysSlots.find((s) => slotWindow(s).start > nowMin);

  // ── Marks lookup for the quick list ──
  const marksByCode = new Map<string, InternalMark>();
  internalMarks?.forEach((m) => {
    if (!marksByCode.has(m.code)) marksByCode.set(m.code, m);
  });

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative' }}>
      {/* Ambient gradient orbs */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '340px',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <motion.div
          animate={{ x: [0, 40, -20, 0], y: [0, 25, 10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: -80,
            left: -60,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.28), transparent 70%)',
          }}
        />
        <motion.div
          animate={{ x: [0, -30, 20, 0], y: [0, 20, -15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: -40,
            right: -50,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)',
          }}
        />
        <motion.div
          animate={{ x: [0, 25, -15, 0], y: [0, -20, 15, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: 120,
            left: '40%',
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(217,70,239,0.16), transparent 70%)',
          }}
        />
      </div>

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '20px',
          padding: '20px 20px 18px',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(59,130,246,0.10) 50%, rgba(217,70,239,0.10))',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 8px 32px rgba(88,28,135,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'rgba(196,181,253,0.8)',
              margin: 0,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}>
              {todayLabel()}
            </p>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'white',
              margin: '6px 0 2px',
              lineHeight: 1.25,
              background: 'linear-gradient(90deg, #fff, #c4b5fd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {greeting()}, {firstName}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', margin: 0 }}>
              Here&apos;s your academic pulse today
            </p>
          </div>
          {profile?.photo ? (
            <div style={{
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: '18px',
              overflow: 'hidden',
              border: '2px solid rgba(139,92,246,0.5)',
              boxShadow: '0 0 20px rgba(139,92,246,0.35)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.photo}
                alt="profile"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{
              flexShrink: 0,
              width: 56,
              height: 56,
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(59,130,246,0.25))',
              border: '1px solid rgba(139,92,246,0.4)',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#e9d5ff',
            }}>
              {firstName[0]}
            </div>
          )}
        </div>

        {/* Bottom row: DO chip + overall ring inline */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginTop: '16px',
        }}>
          {todayDO && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(139,92,246,0.2)',
              border: '1px solid rgba(139,92,246,0.45)',
              boxShadow: '0 0 14px rgba(139,92,246,0.25)',
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#a78bfa',
                boxShadow: '0 0 8px #a78bfa',
              }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e9d5ff' }}>
                {todayDO} today
              </span>
            </div>
          )}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: overallColor,
              boxShadow: `0 0 8px ${overallColor}`,
            }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              {loading ? '…' : `${overall.overallPercentage.toFixed(1)}%`} overall
            </span>
          </div>
          {profile?.semester && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                Sem {profile.semester}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Quick Stats Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginBottom: '24px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Attendance */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08 }}
          onClick={() => router.push('/dashboard/attendance')}
          style={{
            padding: '18px',
            borderRadius: '18px',
            background: 'linear-gradient(160deg, rgba(139,92,246,0.14), rgba(139,92,246,0.04))',
            border: '1px solid rgba(139,92,246,0.22)',
            boxShadow: '0 6px 24px rgba(76,29,149,0.18)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
            <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
              <motion.circle
                cx="32" cy="32" r="26" fill="none" stroke={overallColor} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 26}
                initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - overall.overallPercentage / 100) }}
                transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
              />
            </svg>
            <span style={{
              position: 'absolute',
              fontSize: '0.95rem',
              fontWeight: 800,
              color: overallColor,
            }}>
              {loading ? '—' : `${overall.overallPercentage.toFixed(0)}%`}
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: 600 }}>
            Attendance
          </p>
        </motion.div>

        {/* Below 75% */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.14 }}
          onClick={() => router.push('/dashboard/attendance')}
          style={{
            padding: '18px',
            borderRadius: '18px',
            background: 'linear-gradient(160deg, rgba(239,68,68,0.13), rgba(239,68,68,0.03))',
            border: '1px solid rgba(239,68,68,0.2)',
            boxShadow: '0 6px 24px rgba(127,29,29,0.15)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: overall.subjectsBelowThreshold > 0 ? '#f87171' : '#22c55e',
            textShadow: overall.subjectsBelowThreshold > 0 ? '0 0 18px rgba(248,113,113,0.5)' : '0 0 18px rgba(34,197,94,0.4)',
            marginBottom: '4px',
            lineHeight: 1,
          }}>
            {loading ? '—' : overall.subjectsBelowThreshold}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: 600 }}>
            Below 75%
          </p>
        </motion.div>

        {/* Total classes */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            padding: '18px',
            borderRadius: '18px',
            background: 'linear-gradient(160deg, rgba(59,130,246,0.13), rgba(59,130,246,0.03))',
            border: '1px solid rgba(59,130,246,0.22)',
            boxShadow: '0 6px 24px rgba(30,58,138,0.18)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#93c5fd',
            textShadow: '0 0 18px rgba(147,197,253,0.4)',
            marginBottom: '4px',
            lineHeight: 1,
          }}>
            {loading ? '—' : overall.totalClasses}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: 600 }}>
            Classes Held
          </p>
        </motion.div>

        {/* Safe subjects */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.26 }}
          style={{
            padding: '18px',
            borderRadius: '18px',
            background: 'linear-gradient(160deg, rgba(34,197,94,0.12), rgba(34,197,94,0.03))',
            border: '1px solid rgba(34,197,94,0.22)',
            boxShadow: '0 6px 24px rgba(20,83,45,0.18)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#86efac',
            textShadow: '0 0 18px rgba(134,239,172,0.4)',
            marginBottom: '4px',
            lineHeight: 1,
          }}>
            {loading ? '—' : overall.subjectsSafe}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: 600 }}>
            Safe (≥75%)
          </p>
        </motion.div>
      </div>

      {/* ── Alerts ── */}
      {(!loading || upcomingHolidays.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            position: 'relative',
            zIndex: 1,
            borderRadius: '18px',
            background: 'linear-gradient(165deg, rgba(245,158,11,0.06), rgba(245,158,11,0.015))',
            border: '1px solid rgba(245,158,11,0.16)',
            marginBottom: '24px',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', margin: 0 }}>
              Alerts
            </h2>
            <span style={{ color: '#fbbf24', fontSize: '0.95rem' }}>⚡</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {!loading && overall.subjectsBelowThreshold > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{
                  flexShrink: 0,
                  width: '30px',
                  height: '30px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171',
                  fontSize: '0.95rem',
                }}>
                  ⚠
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'white' }}>
                    {overall.subjectsBelowThreshold} subject{overall.subjectsBelowThreshold > 1 ? 's' : ''} below 75%
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                    {atRisk.slice(0, 2).map((s) => s.courseCode).join(', ')}
                    {atRisk.length > 2 ? ` +${atRisk.length - 2} more` : ''}
                  </p>
                </div>
                <button
                  onClick={() => router.push('/dashboard/attendance')}
                  style={{
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Fix →
                </button>
              </div>
            )}
            {holidayToday && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{
                  flexShrink: 0,
                  width: '30px',
                  height: '30px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: '#86efac',
                  fontSize: '0.95rem',
                }}>
                  🎉
                </span>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'white', flex: 1 }}>
                  Holiday today
                </p>
              </div>
            )}
            {upcomingHolidays.filter((h) => h.date.getTime() !== new Date().setHours(0, 0, 0, 0)).map((h, i) => {
              const daysAway = Math.round((h.date.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
              return (
                <div key={h.date.toISOString()} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  borderBottom: i < upcomingHolidays.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <span style={{
                    flexShrink: 0,
                    width: '30px',
                    height: '30px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: '#93c5fd',
                    fontSize: '0.95rem',
                  }}>
                    📅
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'white' }}>
                      {h.label}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                      {h.date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <span style={{
                    flexShrink: 0,
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.25)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#93c5fd',
                  }}>
                    {daysAway === 0 ? 'TODAY' : daysAway === 1 ? 'TOMORROW' : `IN ${daysAway}d`}
                  </span>
                </div>
              );
            })}
            {!loading && overall.subjectsBelowThreshold === 0 && upcomingHolidays.length === 0 && (
              <p style={{
                margin: 0,
                padding: '16px',
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.75rem',
              }}>
                All clear — no risks or holidays on the horizon.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Today's Classes ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '18px',
          background: 'linear-gradient(165deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
          border: '1px solid rgba(139,92,246,0.18)',
          boxShadow: '0 6px 28px rgba(0,0,0,0.25)',
          marginBottom: '24px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(139,92,246,0.06)',
        }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', margin: 0 }}>
            Today&apos;s Classes
          </h2>
          {todayDO && (
            <span style={{
              padding: '2px 9px',
              borderRadius: '999px',
              background: 'rgba(139,92,246,0.25)',
              border: '1px solid rgba(139,92,246,0.5)',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: '#e9d5ff',
              boxShadow: '0 0 12px rgba(139,92,246,0.3)',
            }}>
              {todayDO}
            </span>
          )}
          <button
            onClick={() => router.push('/dashboard/timetable')}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#a78bfa',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Full timetable →
          </button>
        </div>

        {isAcademiaLoggedIn() && todayDO && (currentClass || nextClass) && (
          <div style={{
            margin: '14px 16px',
            padding: '15px 16px',
            borderRadius: '16px',
            background: currentClass
              ? 'linear-gradient(135deg, rgba(232,121,249,0.18), rgba(139,92,246,0.08))'
              : 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.06))',
            border: currentClass
              ? '1px solid rgba(232,121,249,0.45)'
              : '1px solid rgba(139,92,246,0.35)',
            boxShadow: currentClass
              ? '0 0 24px rgba(232,121,249,0.18)'
              : '0 0 20px rgba(139,92,246,0.12)',
          }}>
            <p style={{
              margin: 0,
              marginBottom: '6px',
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.6px',
              color: currentClass ? '#f0abfc' : '#c4b5fd',
              textTransform: 'uppercase',
            }}>
              {currentClass ? '● In class now' : nextClass ? 'Up next' : ''}
            </p>
            {(currentClass || nextClass) && (
              <>
                <p style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'white',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {(currentClass || nextClass)!.courseTitle}
                </p>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '0.72rem',
                  color: 'rgba(255,255,255,0.55)',
                }}>
                  {(currentClass || nextClass)!.courseCode}
                  {(currentClass || nextClass)!.slot ? ` · ${(currentClass || nextClass)!.slot}` : ''}
                  {' · '}{fmtTime(slotWindow((currentClass || nextClass)!).start)} – {fmtTime(slotWindow((currentClass || nextClass)!).end)}
                  {(currentClass || nextClass)!.room && (currentClass || nextClass)!.room !== 'N/A'
                    ? ` · ${(currentClass || nextClass)!.room}`
                    : ''}
                </p>
              </>
            )}
          </div>
        )}

        {!isAcademiaLoggedIn() && (
          <div style={{ padding: '16px' }}>
            <AcademiaLoginCard onSuccess={handleAcademiaLogin} />
          </div>
        )}

        {isAcademiaLoggedIn() && !todayDO && (
          <p style={{
            padding: '16px',
            margin: 0,
            color: calError ? '#fbbf24' : 'rgba(255,255,255,0.35)',
            fontSize: '0.75rem',
          }}>
            {calError
              ? `Calendar unavailable (${calError}) — your Student Portal session may have expired. Re-login to restore the day order.`
              : 'Could not determine today\'s day order from the calendar.'}
          </p>
        )}

        {isAcademiaLoggedIn() && todayDO && (
          todaysSlots.length === 0 ? (
            <div style={{ padding: '18px 16px', textAlign: 'center' }}>
              <p style={{
                margin: 0,
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}>
                No classes on {todayDO} — enjoy the free day!
              </p>
            </div>
          ) : (
            <div style={{ padding: '16px 16px 8px' }}>
              {/* ── Timeline (progress bar + nodes + labels) ── */}
              <div style={{ position: 'relative', paddingTop: '6px', marginBottom: '8px' }}>
                {/* Track */}
                <div style={{
                  position: 'relative',
                  height: '10px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                }}>
                  {/* Elapsed fill */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
                      boxShadow: '0 0 14px rgba(217,70,239,0.6)',
                    }}
                  />
                  {/* Now marker */}
                  <motion.div
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    style={{
                      position: 'absolute',
                      top: -3,
                      width: '4px',
                      height: '16px',
                      borderRadius: '4px',
                      background: '#fff',
                      boxShadow: '0 0 12px #fff, 0 0 22px rgba(217,70,239,0.9)',
                      left: `${progress * 100}%`,
                      transform: 'translateX(-50%)',
                      zIndex: 3,
                    }}
                  />
                </div>

                {/* Class nodes */}
                {todaysSlots.map((s, i) => {
                  const pct = positionPct(s);
                  const w = slotWindow(s);
                  const done = nowMin >= w.end;
                  const ongoing = nowMin >= w.start && nowMin < w.end;
                  return (
                    <div key={`node-${s.courseCode}-${s.hour}`} style={{
                      position: 'absolute',
                      top: -1,
                      left: `${pct}%`,
                      transform: 'translateX(-50%)',
                      zIndex: 2,
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: done ? 'rgba(139,92,246,0.45)' : ongoing ? '#e879f9' : '#8b5cf6',
                        border: '2px solid #09090f',
                        boxShadow: ongoing
                          ? '0 0 0 4px rgba(232,121,249,0.25), 0 0 12px rgba(232,121,249,0.8)'
                          : '0 0 8px rgba(139,92,246,0.5)',
                      }} />
                    </div>
                  );
                })}
              </div>

              {/* Start / end labels */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '14px',
                fontSize: '0.62rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.3px',
              }}>
                <span>START {fmtTime(dayStart)}</span>
                <span style={{ color: '#e879f9', textShadow: '0 0 10px rgba(232,121,249,0.6)' }}>
                  {progress <= 0 ? 'NOT STARTED' : progress >= 1 ? 'ALL DONE' : `${Math.round(progress * 100)}% ELAPSED`}
                </span>
                <span>END {fmtTime(dayEnd)}</span>
              </div>

              {/* ── Flowchart: class cards in order ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {todaysSlots.map((s, i) => {
                  const w = slotWindow(s);
                  const done = nowMin >= w.end;
                  const ongoing = nowMin >= w.start && nowMin < w.end;
                  return (
                    <motion.div
                      key={`${s.courseCode}-${s.hour}-${s.slot}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 }}
                      style={{ display: 'flex', gap: '12px' }}
                    >
                      {/* Connector column */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '14px',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          marginTop: '16px',
                          background: ongoing ? '#e879f9' : done ? 'rgba(139,92,246,0.4)' : '#8b5cf6',
                          boxShadow: ongoing
                            ? '0 0 0 4px rgba(232,121,249,0.22), 0 0 10px rgba(232,121,249,0.7)'
                            : '0 0 7px rgba(139,92,246,0.5)',
                        }} />
                        {i < todaysSlots.length - 1 && (
                          <div style={{
                            flex: 1,
                            width: '2px',
                            minHeight: '26px',
                            background: 'linear-gradient(180deg, rgba(139,92,246,0.5), rgba(139,92,246,0.12))',
                          }} />
                        )}
                      </div>

                      {/* Card */}
                      <div style={{
                        flex: 1,
                        minWidth: 0,
                        marginBottom: '10px',
                        padding: '11px 13px',
                        borderRadius: '14px',
                        background: ongoing
                          ? 'linear-gradient(160deg, rgba(232,121,249,0.14), rgba(232,121,249,0.03))'
                          : 'rgba(255,255,255,0.03)',
                        border: ongoing
                          ? '1px solid rgba(232,121,249,0.4)'
                          : '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '3px',
                        }}>
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: ongoing ? '#f0abfc' : 'rgba(255,255,255,0.55)',
                            letterSpacing: '0.3px',
                            whiteSpace: 'nowrap',
                          }}>
                            {fmtTime(w.start)} – {fmtTime(w.end)}
                          </span>
                          <span style={{
                            flexShrink: 0,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: s.slot.startsWith('L')
                              ? 'rgba(59,130,246,0.18)'
                              : s.slot.startsWith('P')
                                ? 'rgba(34,197,94,0.15)'
                                : 'rgba(139,92,246,0.2)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.75)',
                          }}>
                            {s.slot}
                          </span>
                          {ongoing && (
                            <span style={{
                              marginLeft: 'auto',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'rgba(232,121,249,0.25)',
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              color: '#f5d0fe',
                              letterSpacing: '0.4px',
                            }}>
                              ● ONGOING
                            </span>
                          )}
                          {done && (
                            <span style={{
                              marginLeft: 'auto',
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              color: 'rgba(255,255,255,0.25)',
                              letterSpacing: '0.4px',
                            }}>
                              DONE
                            </span>
                          )}
                        </div>
                        <p style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: done ? 'rgba(255,255,255,0.5)' : 'white',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {s.courseTitle}
                        </p>
                        <p style={{
                          fontSize: '0.68rem',
                          color: 'rgba(255,255,255,0.4)',
                          margin: '2px 0 0',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {s.courseCode}
                          {s.faculty && s.faculty !== 'N/A' ? ` · ${s.faculty.split('(')[0].trim()}` : ''}
                          {s.room && s.room !== 'N/A' ? ` · ${s.room}` : ''}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </motion.div>

      {/* ── Subjects at Risk ── */}
      {!loading && subjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
              Subjects at Risk
            </h2>
            <button
              onClick={() => router.push('/dashboard/attendance')}
              style={{
                background: 'none',
                border: 'none',
                color: '#a78bfa',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              View all →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {atRisk.slice(0, 3).map((subject, i) => (
              <motion.div
                key={subject.courseCode}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                onClick={() => router.push('/dashboard/attendance')}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'linear-gradient(160deg, rgba(239,68,68,0.1), rgba(239,68,68,0.02))',
                  border: '1px solid rgba(239,68,68,0.2)',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', margin: 0 }}>
                    {subject.courseTitle.length > 30 ? subject.courseTitle.slice(0, 28) + '…' : subject.courseTitle}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                    {subject.courseCode} • {subject.facultyName}
                  </p>
                  <p style={{
                    fontSize: '0.66rem',
                    color: 'rgba(255,255,255,0.3)',
                    margin: '3px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    flexWrap: 'wrap',
                  }}>
                    {[
                      getSubject(subject.courseCode)?.category,
                      getSubject(subject.courseCode)?.credit && getSubject(subject.courseCode)!.credit !== 'N/A'
                        ? `${getSubject(subject.courseCode)!.credit} cr`
                        : null,
                      getSubject(subject.courseCode)?.slot ? `Slot ${getSubject(subject.courseCode)!.slot}` : null,
                      marksByCode.get(subject.courseCode)
                        ? `${marksByCode.get(subject.courseCode)!.scored}/${marksByCode.get(subject.courseCode)!.maxMark} marks`
                        : null,
                    ].filter(Boolean).map((chip) => (
                      <span
                        key={chip}
                        style={{
                          padding: '1px 6px',
                          borderRadius: '5px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                  </p>
                </div>
                <span style={{
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: subject.percentage >= 60 ? '#f97316' : '#f87171',
                }}>
                  {subject.percentage.toFixed(1)}%
                </span>
              </motion.div>
            ))}

            {atRisk.length === 0 && (
              <div style={{
                padding: '20px',
                borderRadius: '14px',
                background: 'linear-gradient(160deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02))',
                border: '1px solid rgba(34,197,94,0.2)',
                textAlign: 'center',
              }}>
                <p style={{ color: '#86efac', fontSize: '0.85rem', fontWeight: 600 }}>
                  All subjects above 75% — you&apos;re safe!
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Grades & Internal Marks */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <GradesSummary refreshKey={gradesKey} />
        <InternalMarks refreshKey={gradesKey} />
      </div>
    </div>
  );
}