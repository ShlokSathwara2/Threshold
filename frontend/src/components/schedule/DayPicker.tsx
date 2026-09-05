"use client";

import { ALL_DAYS, DAY_LABELS, type DayOfWeek } from '@/lib/schedule-classes';

interface Props {
  selected: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
}

export default function DayPicker({ selected, onChange }: Props) {
  const toggle = (day: DayOfWeek) => {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day]);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {ALL_DAYS.map((day) => {
        const active = selected.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: `1px solid ${active ? 'rgba(var(--threshold-accent-rgb),0.5)' : 'rgba(255,255,255,0.1)'}`,
              background: active
                ? 'rgba(var(--threshold-accent-rgb),0.2)'
                : 'rgba(255,255,255,0.04)',
              color: active ? 'var(--threshold-accent-text)' : 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {DAY_LABELS[day]}
          </button>
        );
      })}
    </div>
  );
}
