"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  isSpLoggedIn,
  isCampusWebSession,
  isAcademiaLoggedIn,
  fetchCalendar,
  fetchTimetable,
  fetchSpProfile,
  fetchSpInternalMarks,
  fetchCampusWebUser,
  type CalendarResponse,
  type TimetableResponse,
  type TimetableSlot,
  type SpProfile,
  type InternalMark,
} from '@/lib/api';
import { useAttendance } from '@/hooks/useAttendance';
import { getCached, setCached } from '@/lib/cache';
import { useTheme, hexToRgba, overlay, overlayBg } from '@/lib/theme';
import { loadExams, nextExamDate, daysUntil, formatExamDate, syncExamsFromCloud, type ExamEntry } from '@/lib/exams';
import { lastSyncTime } from '@/lib/api';
import { refreshNotifications } from '@/lib/notifications';
import GradesSummary from '@/components/grades/GradesSummary';
import InternalMarks from '@/components/grades/InternalMarks';
import AcademiaLoginCard from '@/components/academia/AcademiaLoginCard';
import HappyUpdates from '@/components/dashboard/HappyUpdates';
import AttendanceChanges from '@/components/dashboard/AttendanceChanges';
import Announcements from '@/components/dashboard/Announcements';
import UniversalSearch from '@/components/dashboard/UniversalSearch';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { loadOptionalHours, slotKey } from '@/lib/optional-hours';
import { recordAttendanceSnapshot, loadSnapshot, detectAttendanceChanges, type AttendanceChange } from '@/lib/habits';
import { toDate, toDateStr, resolveTodayDayOrder } from '@/lib/day-order';
import { syncWidget } from '@/lib/widget-sync';

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
  const { theme, notif } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const { subjects, overall, loading, stale, refetch: refetchAttendance } = useAttendance();
  const [gradesKey, setGradesKey] = useState(0);
  usePullToRefresh(async () => {
    await refetchAttendance();
    setGradesKey((k) => k + 1);
    await fetchAll();
  });

  const [profile, setProfile] = useState<SpProfile | null>(null);
  const [todayDO, setTodayDO] = useState<string | null>(null);
  const [todayClasses, setTodayClasses] = useState<TimetableSlot[] | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [internalMarks, setInternalMarks] = useState<InternalMark[] | null>(null);
  const [academiaKey, setAcademiaKey] = useState(0);
  const [staleAsOf, setStaleAsOf] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [optedOut, setOptedOut] = useState<Set<string>>(new Set());
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [attendanceChanges, setAttendanceChanges] = useState<AttendanceChange[]>([]);
  const [showFeatureBrief, setShowFeatureBrief] = useState(() => {
    try {
      return localStorage.getItem('threshold_feature_brief_dismissed') !== '1';
    } catch {
      return true;
    }
  });

  // Scroll parallax
  const { scrollY } = useScroll();
  const orbsY = useTransform(scrollY, [0, 400], [0, -80]);
  const heroY = useTransform(scrollY, [0, 300], [0, -15]);
  const statsY = useTransform(scrollY, [0, 500], [0, -8]);

  useEffect(() => {
    setLastSyncAt(lastSyncTime());
    const id = setInterval(() => setLastSyncAt(lastSyncTime()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setExams(loadExams());
    setOptedOut(loadOptionalHours());
    syncExamsFromCloud().then((cloud) => {
      if (cloud) setExams(cloud);
    });
  }, []);

  // Smart local notifications: morning brief + exam reminders + per-class
  // "attend this class" alerts. Rescheduled whenever attendance, exams,
  // timetable, calendar or preferences change (debounced).
  useEffect(() => {
    if (subjects.length === 0) return;
    const t = window.setTimeout(() => {
      void refreshNotifications(subjects, exams, notif, {
        slots: todayClasses ?? [],
        months: calendar?.calendar ?? [],
      });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [subjects, exams, notif, todayClasses, calendar]);

  // Log skip attributions once per day (powers habit insights).
  useEffect(() => {
    if (subjects.length === 0) return;
    const prev = loadSnapshot();
    const changes = detectAttendanceChanges(subjects, prev);
    setAttendanceChanges(changes);
    recordAttendanceSnapshot(subjects, toDateStr(new Date()), todayDO);
  }, [subjects, todayDO]);

  const loadTimetable = async () => {
    if (!isAcademiaLoggedIn() && !isCampusWebSession()) return;
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
    if (!isSpLoggedIn() && !isCampusWebSession()) {
      router.push('/sp-login');
    }
  }, [router]);

  const applyToday = (cal: CalendarResponse | null) => {
    // Resolve today's DO from the date-keyed calendar months — a cached
    // response (or an offline fetch) can never freeze a stale day order.
    const resolved = resolveTodayDayOrder(cal?.calendar ?? []);
    if (resolved) {
      setTodayDO(resolved);
      setCalError(null);
      return;
    }
    if (cal?.calendar?.length) {
      setTodayDO(null);
      setCalError(cal.error ? (cal.message || 'Calendar unavailable') : null);
      return;
    }
    if (cal?.today) {
      const m = cal.today.dayOrder?.match(/Day\s*(\d)/i);
      setTodayDO(m ? `DO-${m[1]}` : null);
      setCalError(null);
      return;
    }
    setTodayDO(null);
    setCalError(null);
  };

  const fetchAll = useCallback(async () => {
    if (isCampusWebSession()) {
      try {
        const user = await fetchCampusWebUser();
        const { adaptCampusWebProfile, adaptCampusWebMarks, adaptCampusWebPlanner } = await import('@/lib/api');
        const session = JSON.parse(localStorage.getItem('threshold_session') || '{}');
        const netId = session?.user || '';

        const profileResp = adaptCampusWebProfile(user, netId);
        if (profileResp.profile) {
          setProfile(profileResp.profile);
          setCached<SpProfile>('profile', { ...profileResp.profile, photo: undefined });
        }

        const marksResp = adaptCampusWebMarks(user);
        const im: InternalMark[] | null = marksResp.marks.length
          ? marksResp.marks.flatMap((m) => {
            const items: InternalMark[] = [];
            if (m.testPerformance?.length) {
              for (const tp of m.testPerformance) {
                items.push({
                  code: m.courseCode,
                  description: tp.test || m.courseName,
                  scored: String(tp.marks?.scored ?? ''),
                  maxMark: String(tp.marks?.total ?? ''),
                });
              }
            } else if (m.overall?.scored) {
              items.push({
                code: m.courseCode,
                description: m.courseName,
                scored: m.overall.scored,
                maxMark: m.overall.total,
              });
            }
            return items;
          })
          : null;
        setInternalMarks(im);
        if (im) setCached<InternalMark[]>('internalMarks', im);

        try {
          const planner: any = await import('@/lib/api').then((m) => m.fetchCampusWebPlanner());
          const cal = adaptCampusWebPlanner(planner);
          setCalendar(cal);
          setCached<CalendarResponse>('calendar', cal);
          applyToday(cal);
          setStaleAsOf(null);
          setOffline(false);
        } catch {
          applyToday(null);
          setOffline(true);
        }

        try {
          const comboBatch = Array.isArray(user.comboBatch)
            ? user.comboBatch[0]
            : String(user.comboBatch || '1');
          const { fetchCampusWebTimetable, adaptCampusWebTimetable } = await import('@/lib/api');
          const ttData: any = await fetchCampusWebTimetable(comboBatch);
          const schedule = adaptCampusWebTimetable(ttData, user.courses);
          setTodayClasses(schedule.length ? schedule : null);
        } catch {
          setTodayClasses(null);
        }
      } catch {
        setProfile(null);
        setInternalMarks(null);
        applyToday(null);
        setOffline(true);
      }
      return;
    }

    // SP path
    const [pRes, calRes, imRes] = await Promise.allSettled([
      fetchSpProfile(),
      fetchCalendar(),
      fetchSpInternalMarks(),
    ]);

    if (pRes.status === 'fulfilled' && pRes.value.profile) {
      const p = pRes.value.profile;
      setProfile(p);
      setCached<SpProfile>('profile', { ...p, photo: undefined });
    }
    if (calRes.status === 'fulfilled') {
      const cal: CalendarResponse = calRes.value;
      setCalendar(cal);
      setCached<CalendarResponse>('calendar', cal);
      applyToday(cal);
      setStaleAsOf(null);
      setOffline(false);
    } else {
      applyToday(null);
      setOffline(true);
    }
    if (imRes.status === 'fulfilled') {
      const im = imRes.value.internal_marks?.length ? imRes.value.internal_marks : null;
      setInternalMarks(im);
      if (im) setCached<InternalMark[]>('internalMarks', im);
    }

    if (!isAcademiaLoggedIn()) {
      setTodayClasses(null);
      return;
    }
    try {
      const tt: TimetableResponse = await fetchTimetable();
      setTodayClasses(tt.schedule?.length ? tt.schedule : null);
    } catch {
      setTodayClasses(null);
    }
  }, []);

  useEffect(() => {
    // Paint cached values instantly so the dashboard is never blank
    const cachedCal = getCached<CalendarResponse>('calendar');
    if (cachedCal) {
      setCalendar(cachedCal.data);
      applyToday(cachedCal.data);
      setStaleAsOf(cachedCal.savedAt);
    }
    const cachedIM = getCached<InternalMark[]>('internalMarks');
    if (cachedIM) setInternalMarks(cachedIM.data);
    const cachedProfile = getCached<SpProfile>('profile');
    if (cachedProfile?.data) setProfile({ ...cachedProfile.data, photo: undefined });

    fetchAll();
  }, [fetchAll]);

  const firstName = profile?.name?.split(' ')[0] || 'Student';
  // Opted-out optional hours are free periods — they never appear in the
  // dashboard's today timetable (count, timeline, current/next class).
  const todaysSlots = todayClasses
    ? todayClasses
      .filter((s) => todayDO && s.day === todayDO && !optedOut.has(slotKey(s)))
      .sort((a, b) => a.hour - b.hour)
    : [];

  useEffect(() => {
    syncWidget(overall, subjects, todayClasses, isSpLoggedIn());
  }, [overall, subjects, todayClasses]);

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

  // ── Alerts: upcoming exams from the local exam tracker ──
  const todayD = new Date();
  todayD.setHours(0, 0, 0, 0);
  const enrichedExams = exams
    .map((e) => ({ entry: e, next: nextExamDate(e, todayD) }))
    .filter((x): x is { entry: ExamEntry; next: Date } => !!x.next)
    .sort((a, b) => a.next.getTime() - b.next.getTime());
  const upcomingExams = enrichedExams
    .filter((x) => daysUntil(x.next, todayD) <= 4)
    .slice(0, 4);
  const nextExam = enrichedExams[0] ?? null;
  const upcomingCount = enrichedExams.length;

  // ── Current / next class ──
  const currentClass = todaysSlots.find((s) => {
    const w = slotWindow(s);
    return nowMin >= w.start && nowMin < w.end;
  });
  const nextClass = todaysSlots.find((s) => slotWindow(s).start > nowMin);

  // ── Bunk planner data (used by Happy Updates) ──
  const futureToday = todaysSlots.filter((s) => slotWindow(s).end > nowMin);

  // ── Today at a glance data ──
  const todayCodes = new Set(todaysSlots.map((s) => s.courseCode));
  const atRiskToday = subjects.filter((s) => s.isBelowThreshold && todayCodes.has(s.courseCode));
  const todayBunkable = todaysSlots.filter((s) => {
    const att = subjects.find((x) => x.courseCode === s.courseCode);
    return (att?.canBunk ?? 0) > 0;
  }).length;

  // ── Dynamic briefs: what matters most RIGHT NOW, ranked by severity ──
  const slotByCode = (code: string) =>
    todaysSlots.find((s) => s.courseCode === code && slotWindow(s).end > nowMin);
  const todayMs = todayD.getTime();
  const nextHoliday = (calendar?.calendar ?? [])
    .flatMap((m) => m.days)
    .find((d) => {
      if (!(d.isHoliday === true || /holiday/i.test(d.event || ''))) return false;
      const dt = toDate(d.date);
      return dt && dt.getTime() >= todayMs;
    });
  const tomorrowDO = (calendar?.calendar ?? [])
    .flatMap((m) => m.days)
    .find((d) => {
      const t = new Date(todayD);
      t.setDate(t.getDate() + 1);
      return d.date === toDateStr(t);
    });
  type Brief = {
    icon: string;
    tone: 'danger' | 'warn' | 'good' | 'info';
    title: string;
    body: string;
    route: string;
  };
  const briefs: Brief[] = [];
  const ovBelow = overall.overallPercentage < 75;
  const ovMustAttend = Math.ceil((0.75 * overall.totalClasses - overall.totalPresent) / 0.25);
  if (ovBelow) {
    briefs.push({
      icon: '🚨',
      tone: 'danger',
      title: 'Detention risk — below 75% overall',
      body: `You're at ${overall.overallPercentage.toFixed(1)}% overall. Attend ${ovMustAttend} more class${ovMustAttend === 1 ? '' : 'es'} to secure 75%.`,
      route: '/dashboard/attendance',
    });
  }
  if (!todayDO) {
    const dayOfWeek = todayD.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const todayEntry = (calendar?.calendar ?? [])
      .flatMap((m) => m.days)
      .find((d) => d.date === toDateStr(todayD));
    if (todayEntry?.isHoliday) {
      briefs.push({
        icon: '🎉',
        tone: 'good',
        title: 'Holiday today — no classes!',
        body: 'Enjoy your day off. Check the calendar for upcoming events.',
        route: '/dashboard/calendar',
      });
    } else if (isWeekend) {
      briefs.push({
        icon: '🌴',
        tone: 'good',
        title: 'Weekend — no classes today',
        body: 'Rest up! Your next class is coming up.',
        route: '/dashboard/timetable',
      });
    }
  }
  for (const s of atRiskToday) {
    const slot = slotByCode(s.courseCode);
    briefs.push({
      icon: '⚠️',
      tone: 'danger',
      title: `Attend ${s.courseCode} today`,
      body: `${s.courseTitle}${slot ? ` at ${fmtTime(slotWindow(slot).start)} (${todayDO})` : ` (${todayDO})`} — you're at ${s.percentage.toFixed(1)}%. ${s.mustAttend} more class${s.mustAttend === 1 ? '' : 'es'} to 75%. Don't skip!`,
      route: '/dashboard/attendance',
    });
  }
  const atRiskNotToday = subjects
    .filter((s) => s.isBelowThreshold && !todayCodes.has(s.courseCode))
    .sort((a, b) => a.percentage - b.percentage);
  for (const s of atRiskNotToday.slice(0, 2)) {
    briefs.push({
      icon: '📉',
      tone: 'warn',
      title: `${s.courseCode} below 75% (${s.percentage.toFixed(1)}%)`,
      body: `${s.courseTitle} — attend ${s.mustAttend} more class${s.mustAttend === 1 ? '' : 'es'} to recover. No class today, next chance is ${s.slot || 'soon'}.`,
      route: '/dashboard/attendance',
    });
  }
  if (upcomingExams.length > 0) {
    const e = upcomingExams[0];
    const days = daysUntil(e.next, todayD);
    briefs.push({
      icon: '📝',
      tone: 'info',
      title: `Exam ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}: ${e.entry.subjectTitle}`,
      body: `${e.entry.subjectCode || ''} — ${days === 0 ? 'give it your best!' : days === 1 ? 'one last revision tonight.' : `you still have ${days} days — plan your revision.`}`.trim(),
      route: '/dashboard/exams',
    });
  }
  if (todayBunkable > 0 && briefs.filter((b) => b.tone === 'danger').length === 0) {
    briefs.push({
      icon: '🕊️',
      tone: 'good',
      title: `You can skip ${todayBunkable} class${todayBunkable === 1 ? '' : 'es'} today`,
      body: 'These subjects are above 75% with spare margin — safe to bunk if you need the time.',
      route: '/dashboard/attendance',
    });
  }
  if (nextHoliday && briefs.length < 4) {
    briefs.push({
      icon: '🎉',
      tone: 'good',
      title: `Holiday coming: ${nextHoliday.event || 'academic break'}`,
      body: `On ${new Date(nextHoliday.date.split('-').reverse().join('-')).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })} — plan your leave around it.`,
      route: '/dashboard/calendar',
    });
  }
  if (tomorrowDO?.dayOrder && briefs.length < 5) {
    const m = tomorrowDO.dayOrder.match(/Day\s*(\d)/i);
    briefs.push({
      icon: '🗓️',
      tone: 'info',
      title: `Tomorrow: ${m ? `DO-${m[1]}` : tomorrowDO.dayOrder}`,
      body: `${tomorrowDO.isHoliday === true ? 'Holiday — no classes.' : `Plan tonight — ${tomorrowDO.event ? `${tomorrowDO.event}. ` : ''}classes start with your ${tomorrowDO.dayOrder} timetable.`}`,
      route: '/dashboard/timetable',
    });
  }
  if (briefs.length === 0) {
    briefs.push({
      icon: '✨',
      tone: 'good',
      title: 'All clear — everything above 75%',
      body: 'No attendance risks, no exams in the next 4 days. Enjoy your day!',
      route: '/dashboard/attendance',
    });
  }
  const shownBriefs = briefs.slice(0, 4);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative' }}>
      {/* Ambient gradient orbs */}
      <motion.div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '340px',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        y: orbsY,
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
            background: `radial-gradient(circle, ${hexToRgba(theme.accent, 0.28)}, transparent 70%)`,
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
      </motion.div>

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '20px',
          padding: '20px 20px 18px',
          marginBottom: '16px',
          y: heroY,
          background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.16), rgba(59,130,246,0.10) 50%, rgba(217,70,239,0.10))',
          border: '1px solid rgba(var(--threshold-accent-rgb),0.25)',
          boxShadow: theme.isLight
            ? '0 8px 32px rgba(109,40,217,0.14), inset 0 1px 0 rgba(255,255,255,0.5)'
            : '0 8px 32px rgba(88,28,135,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
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
              color: theme.isLight ? hexToRgba(theme.accent, 0.8) : 'rgba(196,181,253,0.8)',
              margin: 0,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}>
              {todayLabel()}
            </p>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--threshold-text)',
              margin: '6px 0 2px',
              lineHeight: 1.25,
              background: 'linear-gradient(90deg, #fff, var(--threshold-accent-text))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {greeting()}, {firstName}
            </h1>
            <p style={{ color: W(0.4), fontSize: '0.78rem', margin: 0 }}>
              Here&apos;s your academic pulse today
            </p>
          </div>
          <div style={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.35), rgba(59,130,246,0.25))',
            border: '1px solid rgba(var(--threshold-accent-rgb),0.4)',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: (theme.isLight ? theme.accent : '#e9d5ff'),
          }}>
            {firstName[0]}
          </div>
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
              background: 'rgba(var(--threshold-accent-rgb),0.2)',
              border: '1px solid rgba(var(--threshold-accent-rgb),0.45)',
              boxShadow: '0 0 14px rgba(var(--threshold-accent-rgb),0.25)',
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--threshold-accent-text)',
                boxShadow: '0 0 8px var(--threshold-accent-text)',
              }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: (theme.isLight ? theme.accent : '#e9d5ff') }}>
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
            background: WB(0.05),
            border: `1px solid ${WB(0.1)}`,
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: overallColor,
              boxShadow: `0 0 8px ${overallColor}`,
            }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: W(0.8) }}>
              {loading ? '…' : `${overall.overallPercentage.toFixed(1)}%`} overall
            </span>
          </div>
          {profile?.semester && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 12px',
              borderRadius: '999px',
              background: WB(0.05),
              border: `1px solid ${WB(0.1)}`,
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: W(0.8) }}>
                Sem {profile.semester}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Web-only: features not available notice */}
      {isCampusWebSession() && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            position: 'relative',
            zIndex: 1,
            marginBottom: '16px',
            padding: '14px 16px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
            border: '1px solid rgba(245,158,11,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>⚠</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                Some features are only in the APK
              </p>
              <p style={{ fontSize: '0.72rem', color: W(0.5), margin: '5px 0 0', lineHeight: 1.5 }}>
                Hall Ticket, Exam Timetable, Provisional Results, Course Status, Announcements &amp; Personal Details require the Android app.
              </p>
              <a
                href="https://github.com/ShlokSathwara2/Threshold_APK/raw/main/Threshold.apk"
                download="Threshold.apk"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '10px',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  background: 'rgba(245,158,11,0.18)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#fbbf24',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download APK
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {!isAcademiaLoggedIn() && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => {
            const el = document.getElementById('academia-login');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '14px',
            border: '1px solid rgba(168,85,247,0.35)',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.10))',
            color: '#c084fc',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(168,85,247,0.2)',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <span style={{ fontSize: '1rem' }}>🎓</span>
          Log into Academia for Timetable
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>↓</span>
        </motion.button>
      )}

      {/* ── Offline banner ── */}
      {(offline || stale) && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 14px',
            borderRadius: '14px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))',
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>📡</span>
          <p style={{ margin: 0, flex: 1, fontSize: '0.75rem', fontWeight: 600, color: 'var(--threshold-text)', lineHeight: 1.45 }}>
            {staleAsOf ? (
              <>
                You&apos;re offline — showing data from{' '}
                <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                  {new Date(staleAsOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                . Pull down to refresh when you&apos;re back online.
              </>
            ) : (
              <>You&apos;re offline — connect to the internet to load your data.</>
            )}
          </p>
        </motion.div>
      )}

      {/* ── Feature briefing card ── */}
      {showFeatureBrief && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '16px 18px',
            borderRadius: '18px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.14), rgba(59,130,246,0.08))',
            border: '1px solid rgba(var(--threshold-accent-rgb),0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: theme.text }}>
                Discover more in Settings
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: W(0.5), lineHeight: 1.5 }}>
                Tap <strong>Settings</strong> in the sidebar to enable notifications, tap sounds,
                biometric app lock and data backup — all off by default, you choose what to turn on.
              </p>
            </div>
            <button
              onClick={() => {
                try { localStorage.setItem('threshold_feature_brief_dismissed', '1'); } catch { }
                setShowFeatureBrief(false);
              }}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: W(0.4),
                fontSize: '1rem',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => {
              try { localStorage.setItem('threshold_feature_brief_dismissed', '1'); } catch { }
              setShowFeatureBrief(false);
              router.push('/dashboard/settings');
            }}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(var(--threshold-accent-rgb),0.2)',
              color: theme.isLight ? theme.accent : '#c4b5fd',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Open Settings →
          </button>
        </motion.div>
      )}

      {/* ── Universal search (item 19) ── */}
      <div style={{ position: 'relative', zIndex: 40 }}>
        <UniversalSearch
          subjects={subjects}
          marks={internalMarks ?? []}
          schedule={todayClasses ?? []}
        />
      </div>

      {/* ── Sync status ── */}
      {lastSyncAt !== null && (
        <p style={{
          margin: '-8px 0 14px',
          textAlign: 'center',
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.4px',
          color: W(0.35),
        }}>
          LAST SYNCED {new Date(lastSyncAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · PULL DOWN TO REFRESH
        </p>
      )}

      {/* ── Today's briefs: live, ranked by what matters most ── */}
      {shownBriefs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{
            position: 'relative',
            zIndex: 1,
            borderRadius: '16px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.08), rgba(59,130,246,0.04))',
            border: '1px solid rgba(var(--threshold-accent-rgb),0.2)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderBottom: `1px solid ${WB(0.05)}`,
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>☀️</span>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0, flex: 1 }}>
              Today's briefs
            </h2>
            {todayDO && (
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.4px',
                color: 'var(--threshold-accent-text)',
                padding: '3px 8px',
                borderRadius: '999px',
                background: 'rgba(var(--threshold-accent-rgb),0.15)',
                border: '1px solid rgba(var(--threshold-accent-rgb),0.3)',
              }}>
                {todayDO} · {todaysSlots.length} CLASS{todaysSlots.length === 1 ? '' : 'ES'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {shownBriefs.map((b, i) => (
              <button
                key={i}
                onClick={() => router.push(b.route)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '11px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: i < shownBriefs.length - 1 ? `1px solid ${WB(0.04)}` : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ flexShrink: 0, fontSize: '0.9rem', lineHeight: 1.4 }}>{b.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color:
                      b.tone === 'danger' ? '#f87171'
                        : b.tone === 'warn' ? '#fbbf24'
                          : b.tone === 'good' ? '#4ade80'
                            : 'var(--threshold-text)',
                  }}>
                    {b.title}
                  </span>
                  <span style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: W(0.5),
                    lineHeight: 1.45,
                    marginTop: '2px',
                  }}>
                    {b.body}
                  </span>
                </span>
                <span style={{ flexShrink: 0, fontSize: '0.7rem', color: W(0.3), marginTop: '2px' }}>›</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Attendance changes */}
      <AttendanceChanges
        changes={attendanceChanges}
        onTap={(code) => router.push(`/dashboard/attendance?code=${code}`)}
      />

      {/* ── Quick Stats Grid ── */}
      <motion.div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginBottom: '24px',
        position: 'relative',
        zIndex: 1,
        y: statsY,
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
            background: 'linear-gradient(160deg, rgba(var(--threshold-accent-rgb),0.14), rgba(var(--threshold-accent-rgb),0.04))',
            border: '1px solid rgba(var(--threshold-accent-rgb),0.22)',
            boxShadow: '0 6px 24px rgba(76,29,149,0.18)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
            <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke={WB(0.07)} strokeWidth="5" />
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
          <p style={{ color: 'var(--threshold-text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>
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
          <p style={{ color: 'var(--threshold-text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>
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
          <p style={{ color: 'var(--threshold-text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>
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
          <p style={{ color: 'var(--threshold-text-dim)', fontSize: '0.75rem', fontWeight: 600 }}>
            Safe (≥75%)
          </p>
        </motion.div>
      </motion.div>

      {/* ── Internal Marks (above Alerts) ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <InternalMarks refreshKey={gradesKey} subjects={subjects} />
      </div>

      {/* ── Exams strip ── */}
      {exams.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          onClick={() => router.push('/dashboard/exams')}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '13px 16px',
            borderRadius: '14px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, rgba(217,70,239,0.1), rgba(139,92,246,0.05))',
            border: '1px solid rgba(217,70,239,0.25)',
            cursor: 'pointer',
          }}
        >
          <span style={{
            flexShrink: 0,
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(217,70,239,0.15)',
            border: '1px solid rgba(217,70,239,0.35)',
            fontSize: '1rem',
          }}>
            📝
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
              {nextExam
                ? `Next exam: ${nextExam.entry.subjectTitle}`
                : 'All exams done'}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: W(0.5) }}>
              {nextExam
                ? `${formatExamDate(nextExam.next)} · ${nextExam && daysUntil(nextExam.next, todayD) === 0 ? 'today' : nextExam && daysUntil(nextExam.next, todayD) === 1 ? 'tomorrow' : `in ${daysUntil(nextExam.next, todayD)} days`} · ${upcomingCount} upcoming`
                : 'No upcoming exams — plan the next round'}
            </p>
          </div>
          <span style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--threshold-accent-text)' }}>
            Manage →
          </span>
        </motion.div>
      )}

      {/* ── Alerts ── */}
      {(!loading || upcomingExams.length > 0) && (
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
            borderBottom: `1px solid ${WB(0.05)}`,
          }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
              Alerts
            </h2>
            <span style={{ color: '#fbbf24', fontSize: '0.95rem' }}>⚡</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {!loading && notif.enabled && notif.attendanceRisk && overall.subjectsBelowThreshold > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderBottom: `1px solid ${WB(0.04)}`,
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
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--threshold-text)' }}>
                    {overall.subjectsBelowThreshold} subject{overall.subjectsBelowThreshold > 1 ? 's' : ''} below 75%
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: W(0.4) }}>
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
            {notif.enabled && notif.examDates && upcomingExams.map((x, i) => {
              const days = daysUntil(x.next, todayD);
              return (
                <div key={x.entry.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  borderBottom: i < upcomingExams.length - 1 ? `1px solid ${WB(0.04)}` : 'none',
                }}>
                  <span style={{
                    flexShrink: 0,
                    width: '30px',
                    height: '30px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(217,70,239,0.13)',
                    border: '1px solid rgba(217,70,239,0.3)',
                    color: '#e879f9',
                    fontSize: '0.95rem',
                  }}>
                    📝
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--threshold-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Exam: {x.entry.subjectTitle}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: W(0.4) }}>
                      {formatExamDate(x.next)}
                      {x.entry.description ? ` · ${x.entry.description}` : ''}
                    </p>
                  </div>
                  <span style={{
                    flexShrink: 0,
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: days === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(217,70,239,0.12)',
                    border: `1px solid ${days === 0 ? 'rgba(239,68,68,0.35)' : 'rgba(217,70,239,0.3)'}`,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: days === 0 ? '#f87171' : '#e879f9',
                  }}>
                    {days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `IN ${days}d`}
                  </span>
                  <button
                    onClick={() => router.push('/dashboard/exams')}
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: 'none',
                      color: 'var(--threshold-accent-text)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    View →
                  </button>
                </div>
              );
            })}
            {!loading && overall.subjectsBelowThreshold === 0 && upcomingExams.length === 0 && (
              <p style={{
                margin: 0,
                padding: '16px',
                color: 'var(--threshold-text-faint)',
                fontSize: '0.75rem',
              }}>
                All clear — nothing needs your attention.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Announcements (from the student portal notification board) ── */}
      <Announcements />

      {/* ── Happy updates: bunk planner + spare classes ── */}
      <HappyUpdates
        subjects={subjects}
        schedule={todayClasses ?? []}
        todaySlotsFuture={futureToday}
        todayDO={todayDO}
        optedOut={optedOut}
        onOpenTimetable={() => router.push('/dashboard/timetable')}
        onOpenAttendance={() => router.push('/dashboard/attendance')}
        onOpenExams={() => router.push('/dashboard/exams')}
      />

      {/* ── Today's Classes ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '18px',
          background: theme.isLight
            ? 'linear-gradient(165deg, rgba(0,0,0,0.03), rgba(0,0,0,0.01))'
            : 'linear-gradient(165deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
          border: '1px solid rgba(var(--threshold-accent-rgb),0.18)',
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
          borderBottom: `1px solid ${WB(0.05)}`,
          background: 'rgba(var(--threshold-accent-rgb),0.06)',
        }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
            Today&apos;s Classes
          </h2>
          {todayDO && (
            <span style={{
              padding: '2px 9px',
              borderRadius: '999px',
              background: 'rgba(var(--threshold-accent-rgb),0.25)',
              border: '1px solid rgba(var(--threshold-accent-rgb),0.5)',
              fontSize: '0.62rem',
              fontWeight: 700,
              color: (theme.isLight ? theme.accent : '#e9d5ff'),
              boxShadow: '0 0 12px rgba(var(--threshold-accent-rgb),0.3)',
            }}>
              {todayDO}
            </span>
          )}
          {staleAsOf && (
            <span style={{
              fontSize: '0.58rem',
              fontWeight: 600,
              color: W(0.35),
              letterSpacing: '0.3px',
            }}>
              as of {new Date(staleAsOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => router.push('/dashboard/timetable')}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--threshold-accent-text)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Full timetable →
          </button>
        </div>

        {(isAcademiaLoggedIn() || isCampusWebSession()) && todayDO && (currentClass || nextClass) && (
          <div style={{
            margin: '14px 16px',
            padding: '15px 16px',
            borderRadius: '16px',
            background: currentClass
              ? 'linear-gradient(135deg, rgba(232,121,249,0.18), rgba(var(--threshold-accent-rgb),0.08))'
              : 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.15), rgba(59,130,246,0.06))',
            border: currentClass
              ? '1px solid rgba(232,121,249,0.45)'
              : '1px solid rgba(var(--threshold-accent-rgb),0.35)',
            boxShadow: currentClass
              ? '0 0 24px rgba(232,121,249,0.18)'
              : '0 0 20px rgba(var(--threshold-accent-rgb),0.12)',
          }}>
            <p style={{
              margin: 0,
              marginBottom: '6px',
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.6px',
              color: currentClass ? (theme.isLight ? '#d946ef' : '#f0abfc') : 'var(--threshold-accent-text)',
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
                  color: 'var(--threshold-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {(currentClass || nextClass)!.courseTitle}
                </p>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '0.72rem',
                  color: 'var(--threshold-text-dim)',
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

        {!isAcademiaLoggedIn() && !isCampusWebSession() && (
          <div id="academia-login" style={{ padding: '16px' }}>
            <AcademiaLoginCard onSuccess={handleAcademiaLogin} />
          </div>
        )}

        {(isAcademiaLoggedIn() || isCampusWebSession()) && !todayDO && (
          <p style={{
            padding: '16px',
            margin: 0,
            color: calError ? '#fbbf24' : 'var(--threshold-text-faint)',
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
                color: W(0.4),
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
                  background: WB(0.06),
                  border: `1px solid ${WB(0.05)}`,
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
                      background: 'linear-gradient(90deg, var(--threshold-accent), #d946ef)',
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
                      background: theme.text,
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
                        background: done ? 'rgba(var(--threshold-accent-rgb),0.45)' : ongoing ? '#e879f9' : 'var(--threshold-accent)',
                        border: `2px solid ${theme.bg}`,
                        boxShadow: ongoing
                          ? '0 0 0 4px rgba(232,121,249,0.25), 0 0 12px rgba(232,121,249,0.8)'
                          : '0 0 8px rgba(var(--threshold-accent-rgb),0.5)',
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
                color: W(0.4),
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
                          background: ongoing ? '#e879f9' : done ? 'rgba(var(--threshold-accent-rgb),0.4)' : 'var(--threshold-accent)',
                          boxShadow: ongoing
                            ? '0 0 0 4px rgba(232,121,249,0.22), 0 0 10px rgba(232,121,249,0.7)'
                            : '0 0 7px rgba(var(--threshold-accent-rgb),0.5)',
                        }} />
                        {i < todaysSlots.length - 1 && (
                          <div style={{
                            flex: 1,
                            width: '2px',
                            minHeight: '26px',
                            background: 'linear-gradient(180deg, rgba(var(--threshold-accent-rgb),0.5), rgba(var(--threshold-accent-rgb),0.12))',
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
                          : 'var(--threshold-surface)',
                        border: ongoing
                          ? '1px solid rgba(232,121,249,0.4)'
                          : `1px solid ${WB(0.07)}`,
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
                            color: ongoing ? (theme.isLight ? '#d946ef' : '#f0abfc') : 'var(--threshold-text-dim)',
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
                                : 'rgba(var(--threshold-accent-rgb),0.2)',
                            border: `1px solid ${WB(0.1)}`,
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
                              color: (theme.isLight ? '#d946ef' : '#f5d0fe'),
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
                              color: W(0.25),
                              letterSpacing: '0.4px',
                            }}>
                              DONE
                            </span>
                          )}
                        </div>
                        <p style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: done ? W(0.5) : theme.text,
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {s.courseTitle}
                        </p>
                        <p style={{
                          fontSize: '0.68rem',
                          color: W(0.4),
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

      {/* Grades summary */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <GradesSummary refreshKey={gradesKey} />
      </div>
    </div>
  );
}