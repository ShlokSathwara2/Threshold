"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, hexToRgba } from '@/lib/theme';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  style?: React.CSSProperties;
}

export default function Dropdown({ value, onChange, options, style }: Props) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onTap = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onTap);
    document.addEventListener('touchstart', onTap);
    return () => {
      document.removeEventListener('mousedown', onTap);
      document.removeEventListener('touchstart', onTap);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0, ...style }}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '10px 12px 10px 14px',
          borderRadius: '12px',
          background: open ? hexToRgba(theme.accent, theme.isLight ? 0.06 : 0.09) : 'var(--threshold-surface)',
          border: `1px solid ${open ? hexToRgba(theme.accent, 0.55) : 'var(--threshold-border)'}`,
          boxShadow: open ? `0 0 0 3px ${hexToRgba(theme.accent, 0.13)}, 0 4px 16px ${hexToRgba(theme.accent, 0.12)}` : 'none',
          color: 'var(--threshold-text)',
          fontSize: '0.8rem',
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <span style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selected ? 'var(--threshold-text)' : 'var(--threshold-text-faint)',
        }}>
          {selected ? selected.label : 'Select…'}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          style={{
            flexShrink: 0,
            width: '20px',
            height: '20px',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: open ? hexToRgba(theme.accent, 0.22) : 'var(--threshold-surface-soft)',
            color: open ? 'var(--threshold-accent-text)' : 'var(--threshold-text-dim)',
          }}
        >
          <svg width="9" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 60,
              borderRadius: '14px',
              padding: '6px',
              background: theme.isLight ? '#ffffff' : 'rgba(23,23,32,0.98)',
              border: `1px solid ${theme.isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)'}`,
              boxShadow: `0 18px 48px rgba(0,0,0,${theme.isLight ? 0.2 : 0.55}), 0 0 0 1px ${hexToRgba(theme.accent, 0.14)}, 0 0 24px ${hexToRgba(theme.accent, 0.08)}`,
              overflow: 'hidden',
            }}
            role="listbox"
          >
            {options.map((o, i) => {
              const active = o.value === value;
              return (
                <motion.button
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i, duration: 0.15 }}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: active ? theme.accentDim : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = theme.isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '0.8rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--threshold-accent-text)' : 'var(--threshold-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {o.label}
                  </span>
                  {o.hint && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--threshold-text-faint)', flexShrink: 0 }}>
                      {o.hint}
                    </span>
                  )}
                  <span style={{
                    flexShrink: 0,
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: `1.5px solid ${active ? 'var(--threshold-accent)' : 'var(--threshold-border-strong)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? 'var(--threshold-accent)' : 'transparent',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" style={{ opacity: active ? 1 : 0, transition: 'opacity 0.15s' }}>
                      <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.8" fill="none"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}