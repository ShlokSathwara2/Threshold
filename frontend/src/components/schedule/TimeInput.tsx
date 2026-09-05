"use client";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export default function TimeInput({ label, value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.3px',
      }}>
        {label}
      </label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '10px 12px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--threshold-text)',
          fontSize: '0.85rem',
          fontWeight: 500,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
