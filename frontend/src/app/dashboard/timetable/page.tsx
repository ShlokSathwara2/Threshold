"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isLoggedIn,
  isAcademiaLoggedIn,
  isCampusWebSession,
  getAcademiaUsername,
  setAcademiaCookies,
  academiaLogin,
  fetchTimetable,
  fetchCalendar,
  type TimetableSlot,
  type TimetableResponse,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { useAttendance } from '@/hooks/useAttendance';
import { computeDayRecommendations, slotKey } from '@/lib/bunk-planner';
import { loadOptionalHours, toggleOptionalHour } from '@/lib/optional-hours';
import { loadExams, nextExamDate, daysUntil, type ExamEntry } from '@/lib/exams';
import { resolveTodayDayOrder } from '@/lib/day-order';

const CACHE_PREFIX = 'threshold_timetable_cache';

interface TimetableCache {
  batch: string;
  savedAt: number;
  schedule: TimetableSlot[];
}

const DAYS = ['DO-1', 'DO-2', 'DO-3', 'DO-4', 'DO-5'];

function cacheKey(username: string | null): string {
  return `${CACHE_PREFIX}__${username || 'anon'}`;
}

function loadCache(username: string | null): TimetableCache | null {
  try {
    const raw = localStorage.getItem(cacheKey(username));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(username: string | null, cache: TimetableCache) {
  try {
    localStorage.setItem(cacheKey(username), JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function clearCache(username: string | null) {
  try {
    localStorage.removeItem(cacheKey(username));
  } catch {
    /* ignore */
  }
}

// Times arrive as 12-hour strings without AM/PM: hours ≤ 6 are afternoon
// (e.g. "01:25 - 02:15" = 1:25 PM), 12 is midday, 7–11 are morning.
function parseClock(t: string | undefined): number | null {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let min = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  if (Math.floor(min / 60) <= 6) min += 12 * 60;
  return min;
}

function fmtClock(min: number): string {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  const hh = ((h + 11) % 12) + 1;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${hh}:${mm.toString().padStart(2, '0')} ${ap}`;
}

export default function TimetablePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const { subjects } = useAttendance();
  const [optedOut, setOptedOut] = useState<Set<string>>(new Set());
  const [academiaReady] = useState(() => isAcademiaLoggedIn());
  const [campusWebActive] = useState(() => isCampusWebSession());
  const [schedule, setSchedule] = useState<TimetableSlot[]>([]);
  const [batch, setBatch] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [captcha, setCaptcha] = useState<{ image: string; cdigest: string } | null>(null);
  const [captchaText, setCaptchaText] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
    }
    setOptedOut(loadOptionalHours());
  }, [router]);

  const allHours = [...new Set(schedule.map((s) => s.hour))].sort((a, b) => a - b);

  // Safe-day recommendations per DO column (item 8: optimal bunk planner)
  const dayRecs = useMemo(
    () => computeDayRecommendations(schedule, subjects, optedOut),
    [schedule, subjects, optedOut]
  );

  const [exams, setExams] = useState<ExamEntry[]>([]);
  useEffect(() => {
    setExams(loadExams());
  }, []);
  const nextExamSoon = useMemo(() => {
    const todayD = new Date();
    todayD.setHours(0, 0, 0, 0);
    const next = exams
      .map((e) => ({ entry: e, next: nextExamDate(e, todayD) }))
      .filter((x): x is { entry: ExamEntry; next: Date } => !!x.next)
      .sort((a, b) => a.next.getTime() - b.next.getTime())[0] ?? null;
    return next && daysUntil(next.next, todayD) <= 7 ? next : null;
  }, [exams]);

  // Show a cached timetable for the currently logged-in user (academia or campus web)
  useEffect(() => {
    if (isAcademiaLoggedIn()) {
      const cached = loadCache(getAcademiaUsername());
      if (cached) {
        setSchedule(cached.schedule);
        setBatch(cached.batch);
        setSavedAt(cached.savedAt);
      }
    } else if (isCampusWebSession()) {
      const session = JSON.parse(localStorage.getItem('threshold_session') || '{}');
      const cached = loadCache(session?.user);
      if (cached) {
        setSchedule(cached.schedule);
        setBatch(cached.batch);
        setSavedAt(cached.savedAt);
      }
    }
  }, []);

  const fetchLive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: TimetableResponse = await fetchTimetable();
      if (res.error) throw new Error(res.error);
      const next: TimetableSlot[] = res.schedule || [];
      setSchedule(next);
      setBatch(res.batch || '');
      const now = Date.now();
      setSavedAt(now);
      const cacheUser = isAcademiaLoggedIn() ? getAcademiaUsername() : (() => {
        try { return JSON.parse(localStorage.getItem('threshold_session') || '{}')?.user || 'anon'; } catch { return 'anon'; }
      })();
      saveCache(cacheUser, { batch: res.batch || '', savedAt: now, schedule: next });
      if (next.length === 0) {
        setError('Timetable is empty for your batch — the portal may not have published it yet.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load timetable';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (academiaReady || campusWebActive) {
      fetchLive();
    }
  }, [academiaReady, campusWebActive, fetchLive]);
  usePullToRefresh(() => {
    if (isAcademiaLoggedIn() || isCampusWebSession()) return fetchLive();
    return Promise.resolve();
  });

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError('Enter your academia username and password');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await academiaLogin(
        username.trim(),
        password,
        captcha?.cdigest,
        captcha ? captchaText.trim() : undefined
      );
      if (!res.success) {
        if (res.captcha) {
          setCaptcha(res.captcha);
          setCaptchaText('');
          setLoginError(res.message || 'Enter the CAPTCHA to continue');
        } else {
          setLoginError(res.message || 'Login failed — check your credentials');
        }
        return;
      }
      if (!res.cookies) {
        setLoginError('Login succeeded but no session was returned — try again');
        return;
      }
      setAcademiaCookies(res.cookies, username.trim());
      clearCache(username.trim());
      setCaptcha(null);
      await fetchLive();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  }, [username, password, captcha, captchaText, fetchLive]);

  // Show Academia login when: no session at all, OR Campus Web session but timetable failed
  const needsLogin = !isAcademiaLoggedIn() && (!isCampusWebSession() || (error && schedule.length === 0));

  // Today's DO (e.g. DO-3) is not a fixed weekday — derive it from the
  // SP academic calendar's real day order so the highlight stays correct
  // even when holidays shift the sequence.
  const [todayIndex, setTodayIndex] = useState(-1);
  useEffect(() => {
    let cancelled = false;
    fetchCalendar()
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.calendar) {
          setTodayIndex(-1);
          return;
        }
        const doName = resolveTodayDayOrder(res.calendar);
        const n = doName ? parseInt(doName.split('-')[1], 10) : NaN;
        setTodayIndex(n >= 1 && n <= 5 ? n - 1 : -1);
      })
      .catch(() => {
        if (!cancelled) setTodayIndex(-1);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Free-hour finder (item 15): today's hours with no class or only
  // opted-out optional hours, plus long gaps between consecutive classes.
  const freeHours = useMemo(() => {
    if (todayIndex < 0 || schedule.length === 0) return null;
    const day = DAYS[todayIndex];
    const todays = schedule
      .filter((s) => s.day === day)
      .sort((a, b) => a.hour - b.hour);
    const freeHrs = allHours.filter((h) => {
      const inCell = todays.filter((s) => s.hour === h);
      return inCell.length === 0 || inCell.every((s) => optedOut.has(slotKey(s)));
    });
    const gaps: { from: string; to: string; mins: number }[] = [];
    for (let i = 0; i < todays.length - 1; i++) {
      const endRaw = (todays[i].time || '').split('-')[1];
      const startRaw = (todays[i + 1].time || '').split('-')[0];
      const end = parseClock(endRaw);
      const start = parseClock(startRaw);
      if (end !== null && start !== null && start - end >= 40) {
        gaps.push({ from: fmtClock(end), to: fmtClock(start), mins: start - end });
      }
    }
    return { freeHrs, gaps };
  }, [todayIndex, schedule, optedOut, allHours]);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--threshold-text)', marginBottom: '4px' }}>
          Timetable
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Your weekly schedule from the academia unified timetable
        </p>
        {batch && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            padding: '4px 12px',
            borderRadius: '999px',
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: '#86efac',
          }}>
            Batch {batch}
            {savedAt && (
              <span style={{ color: W(0.4), fontWeight: 400, fontSize: '0.66rem' }}>
                · saved {new Date(savedAt).toLocaleDateString()}
              </span>
            )}
          </span>
        )}
      </motion.div>

      {/* ── Academia login card ── */}
      <AnimatePresence>
        {needsLogin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            style={{
              padding: '20px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--threshold-text)', marginBottom: '4px' }}>
              Academia login needed
            </h2>
            <p style={{ color: W(0.4), fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '14px' }}>
              The timetable lives in academia, not the SP portal — and academia uses its own login
              (your SP credentials won&apos;t work here). It&apos;s per-user and not saved on this
              device — you&apos;ll be asked to log in again each time you open the app.
            </p>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="NetID — ....@srmist.edu.in"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                inputMode="email"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${WB(0.1)}`,
                  background: WB(0.04),
                  color: 'var(--threshold-text)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (academia portal)"
                autoComplete="current-password"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${WB(0.1)}`,
                  background: WB(0.04),
                  color: 'var(--threshold-text)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              {captcha && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: '12px',
                  background: 'var(--threshold-surface)',
                  border: '1px solid var(--threshold-border)',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={captcha.image}
                    alt="captcha"
                    style={{ height: '40px', borderRadius: '8px', flexShrink: 0 }}
                  />
                  <input
                    value={captchaText}
                    onChange={(e) => setCaptchaText(e.target.value)}
                    placeholder="Captcha text"
                    autoCapitalize="none"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: `1px solid ${WB(0.1)}`,
                      background: WB(0.04),
                      color: 'var(--threshold-text)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
              {loginError && (
                <p style={{ color: '#fca5a5', fontSize: '0.78rem', margin: 0 }}>{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loggingIn}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: 'var(--threshold-text)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: loggingIn ? 'wait' : 'pointer',
                  opacity: loggingIn ? 0.6 : 1,
                }}
              >
                {loggingIn ? 'Logging in…' : captcha ? 'Verify & load timetable' : 'Log in & load timetable'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading / error ── */}
      {loading && schedule.length === 0 && (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: `1px solid ${WB(0.06)}`,
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            Loading your batch timetable…
          </p>
        </div>
      )}

      {error && schedule.length === 0 && !needsLogin && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          marginBottom: '12px',
        }}>
          <p style={{ color: '#fca5a5', fontSize: '0.78rem', margin: 0 }}>{error}</p>
        </div>
      )}

      {error && schedule.length === 0 && needsLogin && isCampusWebSession() && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(234, 179, 8, 0.06)',
          border: '1px solid rgba(234, 179, 8, 0.15)',
          marginBottom: '12px',
        }}>
          <p style={{ color: '#fcd34d', fontSize: '0.78rem', margin: 0 }}>
            Your timetable isn&apos;t available through the portal — log in with your Academia credentials below to fetch it.
          </p>
        </div>
      )}

      {error && schedule.length > 0 && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(234, 179, 8, 0.06)',
          border: '1px solid rgba(234, 179, 8, 0.15)',
          marginBottom: '12px',
        }}>
          <p style={{ color: '#fcd34d', fontSize: '0.75rem', margin: 0 }}>
            Showing saved timetable — {error} Re-log in above to refresh.
          </p>
        </div>
      )}

      {/* ── Free-hour finder (today) ── */}
      {schedule.length > 0 && freeHours && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            borderRadius: '16px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            background: 'linear-gradient(165deg, rgba(59,130,246,0.06), rgba(59,130,246,0.015))',
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
              Free hours {todayIndex >= 0 ? `today (${DAYS[todayIndex]})` : ''}
            </h2>
            <span style={{ color: '#60a5fa', fontSize: '0.9rem' }}>⏳</span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {freeHours.freeHrs.length > 0 || freeHours.gaps.length > 0 ? (
              <>
                {freeHours.freeHrs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {freeHours.freeHrs.map((h) => {
                      const tl = schedule.find((s) => s.hour === h)?.time;
                      return (
                        <span key={h} style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          background: 'rgba(59, 130, 246, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#93c5fd',
                        }}>
                          H{h}{tl ? ` · ${tl}` : ''}
                        </span>
                      );
                    })}
                  </div>
                )}
                {freeHours.gaps.length > 0 && (
                  <p style={{ margin: 0, fontSize: '0.7rem', color: W(0.5), lineHeight: 1.5 }}>
                    Long gaps between classes:{' '}
                    {freeHours.gaps.map((g) => `${g.from}–${g.to} (${g.mins} min)`).join(', ')}
                  </p>
                )}
                {nextExamSoon && (
                  <button
                    onClick={() => router.push('/dashboard/exams')}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--threshold-accent-text)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    📝 {nextExamSoon.entry.subjectTitle} exam{' '}
                    {daysUntil(nextExamSoon.next, new Date()) === 0 ? 'today' : `in ${daysUntil(nextExamSoon.next, new Date())} days`} — use a free hour to revise →
                  </button>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: '0.72rem', color: W(0.45) }}>
                No free hours today — full day of classes.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── AcadLoop-style grid: hours × DO columns ── */}
      {!needsLogin && schedule.length === 0 && !loading && !error && (
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: `1px solid ${WB(0.06)}`,
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            No timetable entries yet. Pull down to refresh.
          </p>
        </div>
      )}

      {schedule.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            borderRadius: '16px',
            border: `1px solid ${WB(0.06)}`,
            background: WB(0.02),
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '640px', display: 'flex', flexDirection: 'column' }}>
              {/* Header: corner + day columns */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--threshold-border)',
                background: 'rgba(139, 92, 246, 0.08)',
              }}>
                <div style={{
                  flexShrink: 0,
                  width: '92px',
                  padding: '10px 10px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: 'var(--threshold-text-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  Time / DO
                </div>
                {DAYS.map((day, di) => {
                  const isToday = di === todayIndex;
                  const rec = dayRecs[di];
                  const isSafe = !!rec && rec.hasClasses && rec.safe;
                  return (
                    <div key={day} style={{
                      flex: 1,
                      minWidth: '104px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      borderLeft: `1px solid ${WB(0.05)}`,
                      background: isToday
                        ? 'rgba(139, 92, 246, 0.18)'
                        : isSafe
                          ? 'rgba(34, 197, 94, 0.08)'
                          : 'transparent',
                    }}>
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: isToday ? 'var(--threshold-accent-text)' : theme.text,
                      }}>
                        {day}
                      </span>
                      {isToday && (
                        <span style={{
                          display: 'block',
                          marginTop: '2px',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          color: 'var(--threshold-accent-text)',
                        }}>
                          TODAY
                        </span>
                      )}
                      {isSafe && (
                        <span style={{
                          display: 'inline-block',
                          marginTop: '3px',
                          padding: '1px 7px',
                          borderRadius: '999px',
                          fontSize: '0.52rem',
                          fontWeight: 800,
                          letterSpacing: '0.3px',
                          color: '#4ade80',
                          background: 'rgba(34, 197, 94, 0.14)',
                          border: '1px solid rgba(34, 197, 94, 0.35)',
                        }}>
                          SAFE
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Hour rows */}
              {allHours.map((hour) => {
                const timeLabel =
                  schedule.find((s) => s.hour === hour)?.time || `Hour ${hour}`;
                return (
                  <div
                    key={hour}
                    style={{
                      display: 'flex',
                      borderBottom: `1px solid ${WB(0.04)}`,
                    }}
                  >
                    <div style={{
                      flexShrink: 0,
                      width: '92px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '2px',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      color: W(0.45),
                      letterSpacing: '0.3px',
                    }}>
                      <span>H{hour}</span>
                      <span style={{ fontWeight: 600, color: W(0.25) }}>
                        {timeLabel}
                      </span>
                    </div>
                    {DAYS.map((day, di) => {
                      const inCell = schedule.filter((s) => s.day === day && s.hour === hour);
                      const isToday = di === todayIndex;
                      if (inCell.length === 0) {
                        return (
                          <div key={day} style={{
                            flex: 1,
                            minWidth: '104px',
                            padding: '8px',
                            borderLeft: `1px solid ${WB(0.04)}`,
                            background: isToday ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
                          }} />
                        );
                      }
                      return (
                        <div key={day} style={{
                          flex: 1,
                          minWidth: '104px',
                          padding: '6px',
                          borderLeft: `1px solid ${WB(0.04)}`,
                          background: isToday ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                        }}>
                          {inCell.map((s) => {
                          const isOpt = optedOut.has(slotKey(s));
                          return (
                            <div
                              key={`${s.courseCode}-${hour}-${s.slot}`}
                              style={{
                                padding: '7px 8px',
                                borderRadius: '10px',
                                background: isOpt
                                  ? 'rgba(245, 158, 11, 0.09)'
                                  : s.slot.startsWith('L')
                                    ? 'rgba(59, 130, 246, 0.12)'
                                    : s.slot.startsWith('P')
                                      ? 'rgba(34, 197, 94, 0.1)'
                                      : 'rgba(139, 92, 246, 0.12)',
                                border: isOpt
                                  ? '1px dashed rgba(245, 158, 11, 0.45)'
                                  : '1px solid var(--threshold-border)',
                              }}
                            >
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '4px',
                              }}>
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  color: isOpt ? '#fbbf24' : 'var(--threshold-accent-text)',
                                  letterSpacing: '0.2px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {s.courseCode}
                                </span>
                                <button
                                  onClick={() => setOptedOut(toggleOptionalHour(slotKey(s)))}
                                  title={isOpt ? 'Unmark as optional hour' : 'Mark as optional hour'}
                                  style={{
                                    flexShrink: 0,
                                    padding: '1px 6px',
                                    borderRadius: '6px',
                                    border: isOpt
                                      ? '1px solid rgba(245, 158, 11, 0.5)'
                                      : '1px solid rgba(255,255,255,0.12)',
                                    background: isOpt
                                      ? 'rgba(245, 158, 11, 0.15)'
                                      : 'transparent',
                                    color: isOpt ? '#fbbf24' : W(0.35),
                                    fontSize: '0.5rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.3px',
                                    cursor: 'pointer',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {isOpt ? 'OPT ✓' : 'OPT'}
                                </button>
                              </div>
                              <span style={{
                                display: 'block',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                color: isOpt ? W(0.5) : 'var(--threshold-text)',
                                margin: '2px 0',
                                lineHeight: 1.2,
                                textDecoration: isOpt ? 'line-through' : 'none',
                              }}>
                                {s.courseTitle}
                              </span>
                              <span style={{
                                display: 'block',
                                fontSize: '0.58rem',
                                color: W(0.4),
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {s.faculty && s.faculty !== 'N/A'
                                  ? s.faculty.split('(')[0].trim()
                                  : ''}
                                {s.room && s.room !== 'N/A' ? ` · ${s.room}` : ''}
                              </span>
                            </div>
                          );
                        })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {schedule.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
          <button
            onClick={fetchLive}
            disabled={loading}
            style={{
              padding: '10px 28px',
              borderRadius: '10px',
              border: '1px solid var(--threshold-border)',
              background: 'var(--threshold-surface)',
              color: W(0.4),
              fontSize: '0.8rem',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      )}

      {schedule.length > 0 && (
        <p style={{
          margin: '12px auto 0',
          maxWidth: '520px',
          textAlign: 'center',
          fontSize: '0.62rem',
          color: W(0.3),
          lineHeight: 1.5,
        }}>
          Tap <span style={{ fontWeight: 800, color: W(0.45) }}>OPT</span> on a class to mark it as an
          optional hour you&apos;ve opted out of — it then counts as free time above.
          Green <span style={{ fontWeight: 800, color: '#4ade80' }}>SAFE</span> columns are days where
          skipping every class keeps you above 75%.
        </p>
      )}
    </div>
  );
}