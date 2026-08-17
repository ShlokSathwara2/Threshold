"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchSpInternalMarks, type InternalMark } from '@/lib/api';

export default function InternalMarks({ refreshKey = 0 }: { refreshKey?: number }) {
  const [marks, setMarks] = useState<InternalMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSpInternalMarks();
        if (!cancelled) setMarks(res.internal_marks || []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load internal marks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Loading internal marks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#fca5a5', fontSize: '0.8rem' }}>{error}</p>
      </div>
    );
  }

  if (marks.length === 0) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>No internal marks data available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '24px',
      }}
    >
      <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
        Internal Marks
      </h2>

      {/* â”€â”€ Combined total: all subjects â†’ total obtained â”€â”€ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.14), rgba(59,130,246,0.06))',
        border: '1px solid rgba(var(--threshold-accent-rgb),0.25)',
        marginBottom: '14px',
      }}>
        <div>
          <p style={{
            margin: 0,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--threshold-accent-text)',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
          }}>
            Total Marks
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: 'var(--threshold-text-faint)' }}>
            Combined across {marks.length} subject{marks.length > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--threshold-text)' }}>
            {marks.reduce((acc, m) => acc + (parseFloat(m.scored) || 0), 0).toFixed(1)}
            <span style={{ color: 'var(--threshold-text-faint)', fontWeight: 500, fontSize: '0.85rem' }}>
              {' / '}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {marks.reduce((acc, m) => acc + (parseFloat(m.maxMark) || 0), 0).toFixed(0)}
            </span>
          </span>
          <p style={{
            margin: '3px 0 0',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: (() => {
              const total = marks.reduce((acc, m) => acc + (parseFloat(m.scored) || 0), 0);
              const max = marks.reduce((acc, m) => acc + (parseFloat(m.maxMark) || 0), 0);
              const pct = max > 0 ? (total / max) * 100 : 0;
              return pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444';
            })(),
          }}>
            {(() => {
              const total = marks.reduce((acc, m) => acc + (parseFloat(m.scored) || 0), 0);
              const max = marks.reduce((acc, m) => acc + (parseFloat(m.maxMark) || 0), 0);
              return max > 0 ? `${((total / max) * 100).toFixed(1)}%` : 'â€”';
            })()}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {marks.map((m, i) => {
          const scored = parseFloat(m.scored);
          const max = parseFloat(m.maxMark);
          const pct = max > 0 ? (scored / max) * 100 : 0;
          const barColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444';

          return (
            <motion.div
              key={`${m.code}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--threshold-text)' }}>
                    {m.code}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 6px', fontSize: '0.7rem' }}>Â·</span>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
                    {m.description.length > 30 ? m.description.slice(0, 28) + 'â€¦' : m.description}
                  </span>
                </div>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: barColor,
                  flexShrink: 0,
                  marginLeft: '8px',
                }}>
                  {m.scored}<span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, fontSize: '0.75rem' }}>/{m.maxMark}</span>
                </span>
              </div>

              {/* Progress bar */}
              <div style={{
                height: '3px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.03 }}
                  style={{
                    height: '100%',
                    borderRadius: '2px',
                    background: barColor,
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
