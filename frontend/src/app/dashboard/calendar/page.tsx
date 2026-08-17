"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import {
  isLoggedIn,
  fetchCalendar,
  type CalendarResponse,
  type CalendarMonth,
  type CalendarDay,
} from '@/lib/api';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

export default function CalendarPage() {
  const router = useRouter();
  const [months, setMonths] = useState<CalendarMonth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [doFilter, setDoFilter] = useState<string>('all');
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: false });

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
    fetchLive();
  }, [fetchLive]);
  usePullToRefresh(fetchLive);

  // ── Today highlight ──
  const todayStr = new Date()
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '-');

  const isHoliday = (d: { event?: string }) =>
    /holiday/i.test(d.event || '');

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
        <>
          {/* Quick filter chips */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '2px',
          }}>
            {[
              { value: 'all', label: 'All' },
              { value: 'holiday', label: '🎉 Holidays' },
              ...doNumbers.map((n) => ({ value: `DO-${n}`, label: `DO-${n}` })),
            ].map((chip) => (
              <button
                key={chip.value}
                onClick={() => setDoFilter(chip.value)}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  borderRadius: '999px',
                  border: doFilter === chip.value
                    ? '1px solid rgba(var(--threshold-accent-rgb),0.6)'
                    : '1px solid rgba(255,255,255,0.1)',
                  background: doFilter === chip.value
                    ? 'rgba(var(--threshold-accent-rgb),0.2)'
                    : 'var(--threshold-surface)',
                  color: doFilter === chip.value ? '#e9d5ff' : 'rgba(255,255,255,0.5)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {/* Swipeable month strip (Embla) */}
            <div style={{ flex: 1, overflow: 'hidden' }} ref={emblaRef}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'all', label: 'All months' },
                  ...monthNames.map((name) => ({ value: name, label: name })),
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMonthFilter(m.value)}
                    style={{
                      flex: '0 0 auto',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: monthFilter === m.value
                        ? 'rgba(var(--threshold-accent-rgb),0.2)'
                        : 'rgba(255,255,255,0.04)',
                      border: monthFilter === m.value
                        ? '1px solid rgba(var(--threshold-accent-rgb),0.6)'
                        : '1px solid var(--threshold-border)',
                      color: monthFilter === m.value
                        ? 'var(--threshold-accent-text)'
                        : 'var(--threshold-text-dim)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <select
              value={doFilter}
              onChange={(e) => setDoFilter(e.target.value)}
              style={{
                flexShrink: 0,
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--threshold-border)',
                color: 'var(--threshold-text)',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            >
              <option value="all" style={{ background: '#16161f' }}>All day orders</option>
              <option value="holiday" style={{ background: '#16161f' }}>Holidays only</option>
              {doNumbers.map((n) => (
                <option key={n} value={`DO-${n}`} style={{ background: '#16161f' }}>
                  DO-{n}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* ── Loading / error ── */}
      {loading && months.length === 0 && (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: '1px solid rgba(255,255,255,0.06)',
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
          border: '1px solid rgba(255,255,255,0.06)',
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
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
                {m.month}
              </h2>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}>
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
                      background: holiday ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.04)',
                      border: isToday ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.06)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: holiday ? '#f87171' : 'white',
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
          border: '1px solid rgba(255,255,255,0.06)',
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