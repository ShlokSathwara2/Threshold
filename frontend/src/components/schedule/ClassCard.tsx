"use client";

import { motion } from 'framer-motion';
import { DAY_LABELS, formatTime, type ScheduleClassEntry, type DayOfWeek } from '@/lib/schedule-classes';

interface Props {
  entry: ScheduleClassEntry;
  type: 'step' | 'aptitude';
  onEdit: (entry: ScheduleClassEntry) => void;
  onDelete: (id: string) => void;
  accentColor: string;
}

export default function ClassCard({ entry, type, onEdit, onDelete, accentColor }: Props) {
  const days = [...new Set(entry.schedule.map((s) => s.day))];
  const timeRange = entry.schedule[0]
    ? `${formatTime(entry.schedule[0].startTime)} - ${formatTime(entry.schedule[0].endTime)}`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: '14px',
        background: `linear-gradient(160deg, ${accentColor}11, ${accentColor}05)`,
        border: `1px solid ${accentColor}33`,
        padding: '14px 16px',
        marginBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: accentColor,
          boxShadow: `0 0 8px ${accentColor}80`,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: '0.82rem',
          fontWeight: 700,
          color: 'var(--threshold-text)',
          flex: 1,
        }}>
          {entry.name}
        </span>
        <button
          onClick={() => onEdit(entry)}
          style={{
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.65rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          style={{
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.08)',
            color: '#f87171',
            fontSize: '0.65rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {days.map((day) => (
          <span
            key={day}
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: accentColor,
              background: `${accentColor}18`,
              padding: '2px 8px',
              borderRadius: '6px',
            }}
          >
            {DAY_LABELS[day]}
          </span>
        ))}
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.4)',
        }}>
          {timeRange}
        </span>
      </div>
    </motion.div>
  );
}
