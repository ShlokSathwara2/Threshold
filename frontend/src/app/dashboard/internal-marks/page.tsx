"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn, isAcademiaLoggedIn } from '@/lib/api';
import InternalMarks from '@/components/grades/InternalMarks';
import { usePullToRefresh } from '@/components/ui/PullRefresh';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

export default function InternalMarksPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  usePullToRefresh(refresh);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
    }
  }, [router]);

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

      <InternalMarks refreshKey={refreshKey} />

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