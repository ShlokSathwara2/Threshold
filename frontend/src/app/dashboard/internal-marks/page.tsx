"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn, isAcademiaLoggedIn, isCampusWebSession, fetchCampusWebUser, adaptCampusWebMarks, type Mark } from '@/lib/api';
import InternalMarks from '@/components/grades/InternalMarks';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

export default function InternalMarksPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [refreshKey, setRefreshKey] = useState(0);
  // Full Campus Web marks — component-wise breakdown + per-subject totals.
  const [cwMarks, setCwMarks] = useState<Mark[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  usePullToRefresh(refresh);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
      return;
    }
    if (isCampusWebSession()) {
      setLoaded(false);
      fetchCampusWebUser()
        .then((user) => setCwMarks(adaptCampusWebMarks(user).marks))
        .catch(() => setCwMarks([]))
        .finally(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
  }, [router, refreshKey]);

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
          Internal Marks
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          {/* Only evaluate session-dependent text AFTER mount: the server has
              no localStorage, so branching on it during SSR mismatches. */}
          {!loaded
            ? 'Loading internal marks…'
            : isCampusWebSession()
              ? 'Component-wise marks (FT-I, FT-II, …) with totals — as Campus Web shows them'
              : isAcademiaLoggedIn()
                ? 'Student Portal totals + Academia test-wise breakdowns'
                : 'Student Portal totals — connect Academia for the per-test breakdown'}
        </p>
      </motion.div>

      {!loaded ? (
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: `1px solid ${WB(0.06)}`,
          textAlign: 'center',
        }}>
          <p style={{ color: W(0.3), fontSize: '0.8rem' }}>Loading internal marks...</p>
        </div>
      ) : (
        <InternalMarks
          refreshKey={refreshKey}
          externalMarksRaw={cwMarks}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          onClick={refresh}
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
