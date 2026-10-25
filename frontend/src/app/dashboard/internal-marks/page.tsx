"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn, isAcademiaLoggedIn, isCampusWebSession, fetchCampusWebUser, adaptCampusWebMarks, getAcademiaReloginNotice, type Mark } from '@/lib/api';
import InternalMarks from '@/components/grades/InternalMarks';
import AcademiaLoginCard from '@/components/academia/AcademiaLoginCard';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { getCached, setCached } from '@/lib/cache';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

const CW_MARKS_CACHE = 'campusWebMarks';

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
      // Paint the saved complete breakdown first; only a non-empty fresh
      // answer may replace it.
      const saved = getCached<Mark[]>(CW_MARKS_CACHE);
      if (saved?.data?.length) setCwMarks(saved.data);
      setLoaded(saved?.data?.length ? true : false);
      fetchCampusWebUser()
        .then((user) => {
          const marks = adaptCampusWebMarks(user).marks || [];
          if (marks.length) {
            setCwMarks(marks);
            setCached(CW_MARKS_CACHE, marks);
          } else if (!saved?.data?.length) {
            setCwMarks([]);
          }
        })
        .catch(() => {
          if (!saved?.data?.length) setCwMarks([]);
        })
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
              ? 'Component-wise marks (FT-I, FT-II, …) with totals'
              : isAcademiaLoggedIn()
                ? 'Student Portal totals + Academia test-wise breakdowns'
                : 'Student Portal totals — connect Academia for the per-test breakdown'}
        </p>
      </motion.div>

      {/* Academia connect — same flow the APK shows: sign in once and every
          SP total gains its component-wise (FT-1, quizzes, …) breakdown. */}
      {loaded && !isCampusWebSession() && !isAcademiaLoggedIn() && (
        <div id="academia-login" style={{ marginBottom: '16px' }}>
          <AcademiaLoginCard
            notice={
              getAcademiaReloginNotice()?.to
                ? `It's a new semester (Semester ${getAcademiaReloginNotice()?.to}) — sign in again to load this semester's component marks.`
                : undefined
            }
            onSuccess={refresh}
          />
        </div>
      )}

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
          charts
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
