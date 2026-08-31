"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn, isAcademiaLoggedIn, isCampusWebSession, fetchCampusWebUser, adaptCampusWebMarks, type InternalMark } from '@/lib/api';
import InternalMarks from '@/components/grades/InternalMarks';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

export default function InternalMarksPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const [refreshKey, setRefreshKey] = useState(0);
  const [externalMarks, setExternalMarks] = useState<InternalMark[] | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  usePullToRefresh(refresh);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
      return;
    }
    if (isCampusWebSession()) {
      fetchCampusWebUser().then((user) => {
        const marksResp = adaptCampusWebMarks(user);
        const im: InternalMark[] = marksResp.marks.flatMap((m) => {
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
        });
        setExternalMarks(im.length > 0 ? im : []);
      }).catch(() => setExternalMarks([]));
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
          {isAcademiaLoggedIn()
            ? 'Student Portal totals + Academia test-wise breakdowns'
            : 'Student Portal totals — connect Academia for the per-test breakdown'}
        </p>
      </motion.div>

      <InternalMarks refreshKey={refreshKey} externalMarks={externalMarks} />

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
