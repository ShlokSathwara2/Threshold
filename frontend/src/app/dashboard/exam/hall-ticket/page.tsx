"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isSpLoggedIn,
  fetchSpHallTicket,
  type HallTicketResponse,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';

export default function HallTicketPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [data, setData] = useState<HallTicketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpHallTicket();
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load hall ticket');
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

  const studentEntries = Object.entries(data?.student || {});

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
          Exam Hall Ticket
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Your hall ticket from the Student Portal
        </p>
      </motion.div>

      {loading ? (
        <LoadingState label="Fetching hall ticket…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data?.available ? (
        <EmptyState
          icon="⚑"
          title="No hall ticket available yet"
          hint="Hall tickets appear here once the university publishes them for the upcoming exams."
          onRefresh={load}
        />
      ) : (
        <>
          {studentEntries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: '18px',
                background: `linear-gradient(160deg, rgba(139, 92, 246, 0.12), ${WB(0.02)})`,
                border: '1px solid rgba(139, 92, 246, 0.2)',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {studentEntries.map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <span style={{ fontSize: '0.72rem', color: W(0.4) }}>{k}</span>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--threshold-text)',
                      textAlign: 'right',
                    }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              borderRadius: '18px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 16px 0' }}>
              <p style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--threshold-text)',
              }}>
                Exam subjects
              </p>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.72rem',
                minWidth: '480px',
              }}>
                <thead>
                  <tr>
                    {['Code', 'Subject', 'Date', 'Session', 'Hall', 'Seat'].map((h) => (
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
                  {(data?.subjects || []).map((s, i) => (
                    <motion.tr
                      key={`${s.code}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(0.03 * i, 0.5) }}
                      style={{ borderBottom: `1px solid ${WB(0.04)}` }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--threshold-text)', whiteSpace: 'nowrap' }}>
                        {s.code}
                      </td>
                      <td style={{ padding: '10px 12px', color: W(0.6) }}>{s.description}</td>
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>{s.date}</td>
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>{s.session}</td>
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>{s.hall}</td>
                      <td style={{ padding: '10px 12px', color: W(0.45), whiteSpace: 'nowrap' }}>{s.seat}</td>
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