"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubjectAttendance } from '@/lib/attendance-calculator';

interface Props {
  subject: SubjectAttendance;
  index: number;
}

const statusColors: Record<SubjectAttendance['status'], { bg: string; border: string; text: string; accent: string }> = {
  safe: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', accent: '#22c55e' },
  warning: { bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.2)', text: '#eab308', accent: '#eab308' },
  danger: { bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.2)', text: '#f97316', accent: '#f97316' },
  critical: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', accent: '#ef4444' },
};

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div style={{
      width: '100%',
      height: '4px',
      borderRadius: '2px',
      background: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percentage, 100)}%` }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
        style={{
          height: '100%',
          borderRadius: '2px',
          background: color,
        }}
      />
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      padding: '6px 10px',
      borderRadius: '8px',
      background: 'rgba(255,255,255,0.03)',
      minWidth: '48px',
    }}>
      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: color || 'white' }}>
        {value}
      </span>
    </div>
  );
}

export default function SubjectAttendanceCard({ subject, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colors = statusColors[subject.status];

  const shortTitle = subject.courseTitle.length > 28
    ? subject.courseTitle.slice(0, 26) + '…'
    : subject.courseTitle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: '16px',
        borderRadius: '14px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: colors.text,
              background: `${colors.text}15`,
              padding: '2px 8px',
              borderRadius: '6px',
              letterSpacing: '0.3px',
            }}>
              {subject.courseCode}
            </span>
          </div>
          <h3 style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'white',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {shortTitle}
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
            {subject.facultyName}
          </p>
        </div>

        {/* Percentage Badge */}
        <div style={{
          padding: '6px 12px',
          borderRadius: '10px',
          background: `${colors.text}18`,
          border: `1px solid ${colors.text}30`,
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: colors.text }}>
            {subject.percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar percentage={subject.percentage} color={colors.accent} />

      {/* Stat Pills */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
        <StatPill label="Present" value={subject.present} color="#22c55e" />
        <StatPill label="Absent" value={subject.absent} color="#ef4444" />
        <StatPill label="Total" value={subject.total} />
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {/* Margin Info */}
              {subject.isBelowThreshold ? (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}>
                  <p style={{ fontSize: '0.8rem', color: '#fca5a5', margin: 0, fontWeight: 500 }}>
                    Attend next <span style={{ fontWeight: 700 }}>{subject.mustAttend}</span> consecutive classes to reach 75%
                  </p>
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}>
                  <p style={{ fontSize: '0.8rem', color: '#86efac', margin: 0, fontWeight: 500 }}>
                    Can skip <span style={{ fontWeight: 700 }}>{subject.canBunk}</span> more classes and still stay above 75%
                  </p>
                </div>
              )}

              {/* Category & Slot */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}>
                  {subject.category}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}>
                  Slot: {subject.slot}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
