"use client";

import { motion } from 'framer-motion';
import type { OverallStats } from '@/lib/attendance-calculator';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

interface Props {
  stats: OverallStats;
}

function RingChart({ percentage, size = 80, strokeWidth = 6 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const { theme } = useTheme();
  const WB = (a: number) => overlayBg(theme, a);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const color = percentage >= 85 ? '#22c55e' : percentage >= 75 ? '#eab308' : percentage >= 60 ? '#f97316' : '#ef4444';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={WB(0.06)}
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
      />
    </svg>
  );
}

export default function AttendanceSummary({ stats }: Props) {
  const { overallPercentage, totalPresent, totalAbsent, totalClasses, subjectsBelowThreshold } = stats;
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  const overallColor = overallPercentage >= 85 ? '#22c55e' : overallPercentage >= 75 ? '#eab308' : overallPercentage >= 60 ? '#f97316' : '#ef4444';

  return (
    <motion.div
      className="thr-gradient-border"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '20px',
        alignItems: 'center',
        padding: '20px',
        borderRadius: '16px',
        background: WB(0.03),
        border: `1px solid ${WB(0.06)}`,
        marginBottom: '24px',
      }}
    >
      {/* Ring */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RingChart percentage={overallPercentage} size={80} strokeWidth={6} />
        <div style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: overallColor }}>
            {overallPercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>
          Overall Attendance
        </span>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: W(0.4) }}>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>{totalPresent}</span> present
          </span>
          <span style={{ fontSize: '0.75rem', color: W(0.4) }}>
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{totalAbsent}</span> absent
          </span>
          <span style={{ fontSize: '0.75rem', color: W(0.4) }}>
            <span style={{ color: W(0.6), fontWeight: 600 }}>{totalClasses}</span> total
          </span>
        </div>
      </div>

      {/* Danger badge */}
      {subjectsBelowThreshold > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.4 }}
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {subjectsBelowThreshold} at risk
        </motion.div>
      )}
    </motion.div>
  );
}
