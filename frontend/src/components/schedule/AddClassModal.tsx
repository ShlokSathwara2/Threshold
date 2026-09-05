"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DayPicker from './DayPicker';
import TimeInput from './TimeInput';
import {
  ALL_DAYS,
  DAY_LABELS,
  formatTime,
  type DayOfWeek,
  type ClassSchedule,
  type ScheduleClassEntry,
} from '@/lib/schedule-classes';

interface Props {
  type: 'step' | 'aptitude';
  onSave: (entry: Omit<ScheduleClassEntry, 'id'>) => void;
  onClose: () => void;
  editEntry?: ScheduleClassEntry | null;
}

export default function AddClassModal({ type, onSave, onClose, editEntry }: Props) {
  const [name, setName] = useState(editEntry?.name ?? '');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(
    editEntry ? [...new Set(editEntry.schedule.map((s) => s.day))] : []
  );
  const [startTime, setStartTime] = useState(editEntry?.schedule[0]?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(editEntry?.schedule[0]?.endTime ?? '11:00');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    if (selectedDays.length === 0) {
      setError('Select at least one day');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    const schedule: ClassSchedule[] = selectedDays.map((day) => ({
      day,
      startTime,
      endTime,
    }));

    onSave({ name: name.trim(), schedule });
    onClose();
  };

  const typeLabel = type === 'step' ? 'STEP' : 'Aptitude';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '20px',
            background: 'linear-gradient(160deg, rgba(20,20,30,0.98), rgba(10,10,18,0.98))',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            padding: '24px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
              {editEntry ? 'Edit' : 'Add'} {typeLabel} Class
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.8rem',
              }}
            >
              Close
            </button>
          </div>

          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '6px',
              letterSpacing: '0.3px',
            }}>
              CLASS NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder={`e.g. ${typeLabel} Math`}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--threshold-text)',
                fontSize: '0.85rem',
                fontWeight: 500,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Days */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '8px',
              letterSpacing: '0.3px',
            }}>
              DAYS
            </label>
            <DayPicker selected={selectedDays} onChange={(d) => { setSelectedDays(d); setError(''); }} />
          </div>

          {/* Times */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <TimeInput label="START TIME" value={startTime} onChange={setStartTime} />
            <TimeInput label="END TIME" value={endTime} onChange={setEndTime} />
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: '#f87171', fontSize: '0.75rem', marginBottom: '12px' }}>{error}</p>
          )}

          {/* Preview */}
          {selectedDays.length > 0 && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(var(--threshold-accent-rgb),0.08)',
              border: '1px solid rgba(var(--threshold-accent-rgb),0.15)',
              marginBottom: '16px',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.5)',
            }}>
              {selectedDays.map((d) => DAY_LABELS[d]).join(', ')} · {formatTime(startTime)} - {formatTime(endTime)}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.8), rgba(var(--threshold-accent-rgb),0.6))',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            {editEntry ? 'Save Changes' : `Add ${typeLabel} Class`}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
