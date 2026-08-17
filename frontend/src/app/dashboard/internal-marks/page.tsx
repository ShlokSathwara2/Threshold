"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn } from '@/lib/api';
import { useInternalMarks } from '@/hooks/useInternalMarks';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

export default function InternalMarksPage() {
  const router = useRouter();
  const { marks, loading, error, refetch } = useInternalMarks();
  usePullToRefresh(refetch);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/welcome');
    }
  }, [router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        gap: '16px',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(139, 92, 246, 0.2)',
            borderTopColor: 'var(--threshold-accent)',
            borderRadius: '50%',
          }}
        />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
          Fetching internal marks…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        gap: '16px',
        padding: '20px',
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: '12px' }}>
            {error}
          </p>
          <button
            onClick={refetch}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--threshold-accent-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (marks.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        gap: '16px',
        padding: '20px',
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <p style={{ color: 'var(--threshold-accent-text)', fontSize: '0.9rem', marginBottom: '12px' }}>
            Internal marks haven&apos;t been uploaded yet. They appear here once your faculty publishes them.
          </p>
          <button
            onClick={refetch}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--threshold-accent-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

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
          {marks.length} subject{marks.length === 1 ? '' : 's'} • current semester
        </p>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {marks.map((m, i) => {
          const scored = parseFloat(m.scored);
          const max = parseFloat(m.maxMark);
          const valid = !isNaN(scored) && !isNaN(max) && max > 0;
          const pct = valid ? (scored / max) * 100 : null;
          const color = pct === null ? 'var(--threshold-accent-text)' : pct >= 60 ? '#34d399' : pct >= 40 ? '#facc15' : '#f87171';
          return (
            <motion.div
              key={m.code}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'var(--threshold-surface)',
                border: '1px solid var(--threshold-border)',
              }}
            >
              <div style={{
                minWidth: '52px',
                textAlign: 'center',
                padding: '8px 6px',
                borderRadius: '10px',
                background: `${color}1a`,
                border: `1px solid ${color}40`,
              }}>
                <p style={{
                  color,
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  lineHeight: 1,
                }}>
                  {m.scored}
                </p>
                <p style={{
                  color: 'var(--threshold-text-faint)',
                  fontSize: '0.62rem',
                  marginTop: '2px',
                }}>
                  / {m.maxMark || '—'}
                </p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: 'var(--threshold-text)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {m.description}
                </p>
                <p style={{
                  color: 'var(--threshold-text-faint)',
                  fontSize: '0.72rem',
                  marginTop: '2px',
                }}>
                  {m.code}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          onClick={refetch}
          style={{
            padding: '10px 28px',
            borderRadius: '10px',
            border: '1px solid var(--threshold-border)',
            background: 'var(--threshold-surface)',
            color: 'rgba(255,255,255,0.4)',
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