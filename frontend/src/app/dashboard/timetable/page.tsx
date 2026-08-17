"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isLoggedIn,
  isAcademiaLoggedIn,
  setAcademiaCookies,
  academiaLogin,
  fetchTimetable,
  fetchCalendar,
  type TimetableSlot,
  type TimetableResponse,
} from '@/lib/api';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

const CACHE_KEY = 'threshold_timetable_cache';

interface TimetableCache {
  batch: string;
  savedAt: number;
  schedule: TimetableSlot[];
}

const DAYS = ['DO-1', 'DO-2', 'DO-3', 'DO-4', 'DO-5'];

function loadCache(): TimetableCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCache(cache: TimetableCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

export default function TimetablePage() {
  const router = useRouter();
  const [academiaReady] = useState(() => isAcademiaLoggedIn());
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
      router.push('/login');
    }
  }, [router]);

  // Show any cached timetable immediately
  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setSchedule(cached.schedule);
      setBatch(cached.batch);
      setSavedAt(cached.savedAt);
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
      saveCache({ batch: res.batch || '', savedAt: now, schedule: next });
      if (next.length === 0) {
        setError('Timetable is empty for your batch — the portal may not have published it yet.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load timetable';
      // Keep the academia cookie — a transient error (deploy, timeout) shouldn't
      // wipe the saved session. Show the error; the user can re-login if it persists.
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (academiaReady) {
      fetchLive();
    }
  }, [academiaReady, fetchLive]);
  usePullToRefresh(() => {
    if (isAcademiaLoggedIn()) return fetchLive();
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
      setAcademiaCookies(res.cookies);
      setCaptcha(null);
      await fetchLive();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  }, [username, password, captcha, captchaText, fetchLive]);

  const needsLogin = !isAcademiaLoggedIn();

  // Today's DO (e.g. DO-3) is not a fixed weekday — derive it from the
  // SP academic calendar's real day order so the highlight stays correct
  // even when holidays shift the sequence.
  const [todayIndex, setTodayIndex] = useState(-1);
  useEffect(() => {
    let cancelled = false;
    fetchCalendar()
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.today) {
          setTodayIndex(-1);
          return;
        }
        const m = res.today.dayOrder?.match(/Day\s*(\d)/i);
        const n = m ? parseInt(m[1], 10) : NaN;
        setTodayIndex(n >= 1 && n <= 5 ? n - 1 : -1);
      })
      .catch(() => {
        if (!cancelled) setTodayIndex(-1);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allHours = [...new Set(schedule.map((s) => s.hour))].sort((a, b) => a - b);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
          Timetable
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
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
              <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400, fontSize: '0.66rem' }}>
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
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
              Academia login needed
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '14px' }}>
              The timetable lives in academia, not the SP portal — and academia uses its own login
              (your SP credentials won&apos;t work here). It&apos;s saved after the first load and
              stays until the semester ends.
            </p>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Academia username (reg number)"
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'white',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'white',
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
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
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
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'white',
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
                  color: 'white',
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
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
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

      {/* ── AcadLoop-style grid: hours × DO columns ── */}
      {!needsLogin && schedule.length === 0 && !loading && !error && (
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
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
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '640px', display: 'flex', flexDirection: 'column' }}>
              {/* Header: corner + day columns */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(139, 92, 246, 0.08)',
              }}>
                <div style={{
                  flexShrink: 0,
                  width: '92px',
                  padding: '10px 10px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.35)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  Time / DO
                </div>
                {DAYS.map((day, di) => {
                  const isToday = di === todayIndex;
                  return (
                    <div key={day} style={{
                      flex: 1,
                      minWidth: '104px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      borderLeft: '1px solid rgba(255,255,255,0.05)',
                      background: isToday ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                    }}>
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: isToday ? '#c4b5fd' : 'white',
                      }}>
                        {day}
                      </span>
                      {isToday && (
                        <span style={{
                          display: 'block',
                          marginTop: '2px',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          color: '#a78bfa',
                        }}>
                          TODAY
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
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
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
                      color: 'rgba(255,255,255,0.45)',
                      letterSpacing: '0.3px',
                    }}>
                      <span>H{hour}</span>
                      <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.25)' }}>
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
                            borderLeft: '1px solid rgba(255,255,255,0.04)',
                            background: isToday ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
                          }} />
                        );
                      }
                      return (
                        <div key={day} style={{
                          flex: 1,
                          minWidth: '104px',
                          padding: '6px',
                          borderLeft: '1px solid rgba(255,255,255,0.04)',
                          background: isToday ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                        }}>
                          {inCell.map((s) => (
                            <div
                              key={`${s.courseCode}-${hour}-${s.slot}`}
                              style={{
                                padding: '7px 8px',
                                borderRadius: '10px',
                                background:
                                  s.slot.startsWith('L')
                                    ? 'rgba(59, 130, 246, 0.12)'
                                    : s.slot.startsWith('P')
                                      ? 'rgba(34, 197, 94, 0.1)'
                                      : 'rgba(139, 92, 246, 0.12)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <span style={{
                                display: 'block',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                color: '#c4b5fd',
                                letterSpacing: '0.2px',
                              }}>
                                {s.courseCode}
                              </span>
                              <span style={{
                                display: 'block',
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                color: 'white',
                                margin: '2px 0',
                                lineHeight: 1.2,
                              }}>
                                {s.courseTitle}
                              </span>
                              <span style={{
                                display: 'block',
                                fontSize: '0.58rem',
                                color: 'rgba(255,255,255,0.4)',
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
                          ))}
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
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.8rem',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      )}
    </div>
  );
}