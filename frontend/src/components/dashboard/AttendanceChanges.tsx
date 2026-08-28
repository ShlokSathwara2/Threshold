"use client";

import { motion } from 'framer-motion';
import type { AttendanceChange } from '@/lib/habits';

interface Props {
  changes: AttendanceChange[];
  onTap: (code: string) => void;
}

export default function AttendanceChanges({ changes, onTap }: Props) {
  if (changes.length === 0) return null;

  return (
    <motion.div
      className="thr-gradient-border"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      style={{
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        marginBottom: '14px',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '0.85rem' }}>📋</span>
        <span style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: 'var(--threshold-text)',
        }}>
          Attendance Update
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.62rem',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
        }}>
          Today
        </span>
      </div>

      {/* Change rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {changes.map((change, i) => {
          const isAbsent = change.type === 'absent';
          return (
            <motion.button
              key={change.courseCode}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => onTap(change.courseCode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: i < changes.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.2s',
              }}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Status dot */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isAbsent ? '#ef4444' : '#22c55e',
                boxShadow: isAbsent
                  ? '0 0 8px rgba(239,68,68,0.5)'
                  : '0 0 8px rgba(34,197,94,0.5)',
                flexShrink: 0,
              }} />

              {/* Subject code */}
              <span style={{
                fontSize: '0.64rem',
                fontWeight: 700,
                color: isAbsent ? '#fca5a5' : '#86efac',
                background: isAbsent ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                padding: '2px 7px',
                borderRadius: '6px',
                flexShrink: 0,
              }}>
                {change.courseCode}
              </span>

              {/* Description */}
              <span style={{
                flex: 1,
                fontSize: '0.72rem',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.4,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {change.courseTitle}
              </span>

              {/* Change label */}
              <span style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: isAbsent ? '#ef4444' : '#22c55e',
                flexShrink: 0,
              }}>
                {isAbsent ? '−' : '+'}{change.delta} {isAbsent ? 'absent' : 'present'}
              </span>

              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
