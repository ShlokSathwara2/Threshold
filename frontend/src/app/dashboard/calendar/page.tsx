"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isLoggedIn,
  isAcademiaLoggedIn,
  setAcademiaCookies,
  academiaLogin,
  fetchCalendar,
  type CalendarResponse,
  type CalendarMonth,
} from '@/lib/api';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

export default function CalendarPage() {
  const router = useRouter();
  const [months, setMonths] = useState<CalendarMonth[]>([]);
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

  const fetchLive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: CalendarResponse = await fetchCalendar();
      if (res.error) throw new Error(res.message || 'Could not load calendar');
      setMonths(res.calendar || []);
      if (!res.calendar || res.calendar.length === 0) {
        setError('No calendar data found — the planner may not be published yet.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load calendar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAcademiaLoggedIn()) {
      fetchLive();
    }
  }, [fetchLive]);
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

  // ── Today highlight ──
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
          Calendar
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
          Academic planner — holidays, exams and important dates
        </p>
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
              The academic planner lives in academia and uses its own login. It&apos;s saved after
              the first load and shared with the timetable.
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
                {loggingIn ? 'Logging in…' : captcha ? 'Verify & load calendar' : 'Log in & load calendar'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading / error ── */}
      {loading && months.length === 0 && (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
            Loading academic calendar…
          </p>
        </div>
      )}

      {error && months.length === 0 && !needsLogin && (
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

      {!needsLogin && months.length === 0 && !loading && !error && (
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
            Pull down to load the academic planner.
          </p>
        </div>
      )}

      {/* ── Month cards ── */}
      {months.map((m, mi) => (
        <motion.div
          key={`${m.month}-${m.year}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: mi * 0.05 }}
          style={{
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '12px',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', margin: 0 }}>
              {m.month} {m.year}
            </h2>
            <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}>
              {m.days.filter((d) => d.type === 'holiday').length} holidays
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {m.days.map((d, di) => {
              const isToday = d.date === todayStr;
              const isHoliday = d.type === 'holiday';
              return (
                <div
                  key={d.date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    borderBottom: di < m.days.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isToday ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                  }}
                >
                  <div style={{
                    flexShrink: 0,
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isHoliday ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.04)',
                    border: isToday ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: isHoliday ? '#f87171' : 'white',
                  }}>
                    {d.day}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'white',
                      margin: 0,
                    }}>
                      {d.dayOfWeek}
                      {isToday && (
                        <span style={{
                          marginLeft: '6px',
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: 'rgba(139, 92, 246, 0.2)',
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          color: '#c4b5fd',
                        }}>
                          TODAY
                        </span>
                      )}
                    </p>
                  </div>
                  {isHoliday && (
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      color: '#f87171',
                      flexShrink: 0,
                    }}>
                      HOLIDAY
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
}