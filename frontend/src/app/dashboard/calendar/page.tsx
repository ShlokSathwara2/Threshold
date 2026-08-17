"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isLoggedIn,
  fetchCalendar,
  type CalendarResponse,
  type CalendarMonth,
  type CalendarDay,
} from '@/lib/api';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import Dropdown from '@/components/ui/Dropdown';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

export default function CalendarPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [months, setMonths] = useState<CalendarMonth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [doFilter, setDoFilter] = useState<string>('all');

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
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
    fetchLive();
  }, [fetchLive]);
  usePullToRefresh(fetchLive);

  // ── Today highlight ──
  const todayStr = new Date()
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '-');

const isHoliday = (d: { event?: string; isHoliday?: boolean }) =>
    d.isHoliday === true || /holiday/i.test(d.event || '');

  // ── Dynamic filter options, derived from loaded data ──
  const doNumbers = useMemo(() => {
    const set = new Set<number>();
    months.forEach((m) =>
      m.days.forEach((d) => {
        const match = d.dayOrder?.match(/Day\s*(\d)/i);
        if (match) set.add(parseInt(match[1], 10));
      })
    );
    return [...set].sort((a, b) => a - b);
  }, [months]);

  const monthNames = useMemo(() => months.map((m) => m.month), [months]);

  const matchesDoFilter = (d: CalendarDay) => {
    if (doFilter === 'all') return true;
    if (doFilter === 'holiday') return isHoliday(d);
    const match = d.dayOrder?.match(/Day\s*(\d)/i);
    return match && match[1] === doFilter.replace('DO-', '');
  };

  const visibleMonths = useMemo(() => {
    const source = monthFilter === 'all' ? months : months.filter((m) => m.month === monthFilter);
    if (doFilter === 'all') return source;
    return source.map((m) => ({
      ...m,
      days: m.days.filter(matchesDoFilter),
    })).filter((m) => m.days.length > 0);
  }, [months, monthFilter, doFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--threshold-text)', marginBottom: '4px' }}>
          Calendar
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Academic planner — day orders, holidays and important dates
        </p>
      </motion.div>

      {/* ── Filters (options are derived from loaded data) ── */}
      {months.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
        }}>
          <Dropdown
            value={monthFilter}
            onChange={setMonthFilter}
            options={[
              { value: 'all', label: 'All months' },
              ...monthNames.map((name) => ({ value: name, label: name })),
            ]}
          />
          <Dropdown
            value={doFilter}
            onChange={setDoFilter}
            options={[
              { value: 'all', label: 'All day orders' },
              { value: 'holiday', label: 'Holidays only', hint: '🎉' },
              ...doNumbers.map((n) => ({ value: `DO-${n}`, label: `DO-${n}` })),
            ]}
          />
        </div>
      )}

      {/* ── Loading / error ── */}
      {loading && months.length === 0 && (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: `1px solid ${WB(0.06)}`,
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            Loading academic calendar…
          </p>
        </div>
      )}

      {error && months.length === 0 && (
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

      {months.length === 0 && !loading && !error && (
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: `1px solid ${WB(0.06)}`,
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            Pull down to load the academic planner.
          </p>
        </div>
      )}

      {/* ── Month cards ── */}
      {visibleMonths.map((m, mi) => {
        const holidayCount = m.days.filter((d) => isHoliday(d)).length;
        return (
          <motion.div
            key={m.month}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: mi * 0.05 }}
            style={{
              borderRadius: '16px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              marginBottom: '12px',
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
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
                {m.month}
              </h2>
              <span style={{ marginLeft: 'auto', color: W(0.25), fontSize: '0.72rem' }}>
                {holidayCount} holidays
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {m.days.map((d, di) => {
                const isToday = d.date === todayStr;
                const holiday = isHoliday(d);
                const dayOrderMatch = d.dayOrder?.match(/Day\s*(\d)/i);
                return (
                  <div
                    key={d.date}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 16px',
                      borderBottom: di < m.days.length - 1 ? `1px solid ${WB(0.04)}` : 'none',
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
                      background: holiday ? 'rgba(239, 68, 68, 0.1)' : WB(0.04),
                      border: isToday ? '1px solid rgba(139, 92, 246, 0.5)' : `1px solid ${WB(0.06)}`,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: holiday ? '#f87171' : theme.text,
                    }}>
                      {d.date?.split('-')[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--threshold-text)',
                        margin: 0,
                      }}>
                        {d.day}
                        {isToday && (
                          <span style={{
                            marginLeft: '6px',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            background: 'rgba(139, 92, 246, 0.2)',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: 'var(--threshold-accent-text)',
                          }}>
                            TODAY
                          </span>
                        )}
                      </p>
                      {d.dayOrder && !holiday && (
                        <p style={{
                          fontSize: '0.68rem',
                          color: 'rgba(167, 139, 250, 0.8)',
                          margin: '2px 0 0',
                          fontWeight: 500,
                        }}>
                          DO-{dayOrderMatch?.[1] ?? '?'} · {d.dayOrder}
                        </p>
                      )}
                      {holiday && (
                        <p style={{
                          fontSize: '0.68rem',
                          color: 'rgba(248, 113, 113, 0.8)',
                          margin: '2px 0 0',
                          fontWeight: 500,
                        }}>
                          {d.event}
                        </p>
                      )}
                    </div>
                    {holiday && (
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
        );
      })}

      {months.length > 0 && visibleMonths.length === 0 && (
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: `1px solid ${WB(0.06)}`,
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            No entries match the selected filters.
          </p>
        </div>
      )}
    </div>
  );
}