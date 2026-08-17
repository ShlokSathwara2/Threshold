"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isSpLoggedIn,
  fetchSpProvisionalResults,
  type ProvisionalResultsResponse,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';

export default function ProvisionalResultsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [data, setData] = useState<ProvisionalResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpProvisionalResults();
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load provisional results');
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

  const rows = data?.rows || [];
  const headers = rows.length > 0
    ? Object.keys(rows[0]).map((k) => k.replace(/_/g, ' '))
    : [];

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
          Provisional Results
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Semester results from the Student Portal
        </p>
      </motion.div>

      {loading ? (
        <LoadingState label="Fetching provisional results…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data?.available || rows.length === 0 ? (
        <EmptyState
          icon="★"
          title="No results published yet"
          hint="Your provisional results will appear here once the university publishes them."
          onRefresh={load}
        />
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              borderRadius: '18px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.74rem',
                minWidth: '420px',
              }}>
                <thead>
                  <tr>
                    {headers.map((h) => (
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
                  {rows.map((r, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(0.05 * i, 0.4) }}
                      style={{ borderBottom: `1px solid ${WB(0.04)}` }}
                    >
                      {Object.keys(rows[0]).map((k) => (
                        <td key={k} style={{
                          padding: '12px',
                          color: /sgpa|gpa|grade/i.test(k)
                            ? 'var(--threshold-accent-text)'
                            : W(0.6),
                          fontWeight: /sgpa|gpa/i.test(k) ? 700 : 400,
                          whiteSpace: 'nowrap',
                        }}>
                          {r[k] || '—'}
                        </td>
                      ))}
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