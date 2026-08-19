"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fromInputValue, toDate, toDateStr, displayDate } from '@/lib/day-order';
import { useTheme, overlay, overlayBg, type ThemePalette } from '@/lib/theme';

interface Props {
  onApply: (dates: string[]) => void;
  onReset: () => void;
  active: boolean;
  leaveDays: number;
  leaveFrom?: string | null;
  leaveTo?: string | null;
  missedTotal: number;
  subjectsDropping: number;
  overall?: {
    present: number;
    absent: number;
    total: number;
    percentage: number;
    margin: number;
    canBunk: number;
    mustAttend: number;
    below75: boolean;
  } | null;
}

const inputStyle = (theme: ThemePalette): React.CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '9px 10px',
  borderRadius: '10px',
  background: overlayBg(theme, 0.04),
  border: '1px solid var(--threshold-border)',
  color: 'var(--threshold-text)',
  fontSize: '0.78rem',
  fontWeight: 600,
  outline: 'none',
  colorScheme: theme.isLight ? 'light' : 'dark',
});

const buttonStyle = (primary: boolean): React.CSSProperties => ({
  flexShrink: 0,
  padding: '9px 14px',
  borderRadius: '10px',
  border: primary ? 'none' : '1px solid var(--threshold-border)',
  background: primary ? 'var(--threshold-accent)' : 'var(--threshold-surface)',
  color: primary ? '#fff' : 'var(--threshold-text-dim)',
  fontSize: '0.75rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s',
});

export default function LeavePlanner({
  onApply,
  onReset,
  active,
  leaveDays,
  leaveFrom,
  leaveTo,
  missedTotal,
  subjectsDropping,
  overall,
}: Props) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [single, setSingle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const parseInput = (v: string) => {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const addRange = () => {
    if (!from || !to) return;
    const start = parseInput(from);
    const end = parseInput(to);
    if (end < start) return;
    const added: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const ds = toDateStr(cur);
      if (!selected.includes(ds)) added.push(ds);
      cur.setDate(cur.getDate() + 1);
    }
    if (added.length > 0) setSelected((s) => [...s, ...added]);
    setFrom('');
    setTo('');
  };

  const addSingle = () => {
    if (!single) return;
    const ds = fromInputValue(single);
    if (ds && !selected.includes(ds)) setSelected((s) => [...s, ds]);
    setSingle('');
  };

  const remove = (ds: string) => setSelected((s) => s.filter((x) => x !== ds));

  const handleApply = () => {
    if (selected.length === 0) return;
    onApply(selected);
    setOpen(false);
  };

  const handleReset = () => {
    setSelected([]);
    onReset();
  };

  const today = toDateStr(new Date());

  // Day before the leave starts — every class up to (and including) this day
  // is assumed attended in the projection.
  const assumeTill = leaveFrom
    ? (() => {
        const d = toDate(leaveFrom);
        if (!d) return null;
        d.setDate(d.getDate() - 1);
        return d;
      })()
    : null;

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Single entry button */}
      <button
        onClick={() => {
          if (active) return;
          setOpen(!open);
        }}
        disabled={active}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '13px',
          borderRadius: '14px',
          border: open
            ? '1px solid rgba(var(--threshold-accent-rgb),0.5)'
            : '1px solid var(--threshold-border)',
          background: open ? 'rgba(var(--threshold-accent-rgb),0.1)' : 'var(--threshold-surface)',
          color: open ? 'var(--threshold-accent-text)' : 'var(--threshold-text-dim)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s',
          opacity: active ? 0.5 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
        {active ? 'Leave projection active' : 'Leave planner'}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && !active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: '8px',
              padding: '14px',
              borderRadius: '14px',
              background: WB(0.03),
              border: '1px solid var(--threshold-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {/* From–to range */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} style={inputStyle(theme)} aria-label="Leave from" />
                <span style={{ color: W(0.3), fontSize: '0.75rem', flexShrink: 0 }}>→</span>
                <input type="date" value={to} min={from || today} onChange={(e) => setTo(e.target.value)} style={inputStyle(theme)} aria-label="Leave to" />
                <button onClick={addRange} style={buttonStyle(true)} disabled={!from || !to}>
                  Add range
                </button>
              </div>

              <p style={{ margin: 0, fontSize: '0.68rem', color: W(0.4), lineHeight: 1.5 }}>
                The projection assumes you attend <span style={{ fontWeight: 800, color: W(0.6) }}>every class from today</span> until
                your leave starts, then miss every class during the leave — totals update to the end of the leave.
              </p>

              {/* Single date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="date" value={single} min={today} onChange={(e) => setSingle(e.target.value)} style={inputStyle(theme)} aria-label="Single leave date" />
                <button onClick={addSingle} style={buttonStyle(false)} disabled={!single}>
                  Add date
                </button>
              </div>

              {/* Selected dates */}
              {selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selected
                    .slice()
                    .sort((a, b) => (a < b ? -1 : 1))
                    .map((ds) => (
                      <span key={ds} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 8px 5px 10px',
                        borderRadius: '999px',
                        background: 'rgba(var(--threshold-accent-rgb),0.12)',
                        border: '1px solid rgba(var(--threshold-accent-rgb),0.3)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--threshold-accent-text)',
                      }}>
                        {displayDate(ds)}
                        <button
                          onClick={() => remove(ds)}
                          aria-label={`Remove ${ds}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            fontSize: '0.8rem',
                            lineHeight: 1,
                            cursor: 'pointer',
                            padding: 0,
                            opacity: 0.7,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}

              <button
                onClick={handleApply}
                disabled={selected.length === 0}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: selected.length > 0 ? 'var(--threshold-accent)' : WB(0.06),
                  color: selected.length > 0 ? '#fff' : W(0.3),
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                Apply leave projection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active projection summary + reset */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: '8px',
              padding: '14px',
              borderRadius: '14px',
              background: subjectsDropping > 0 ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.06)',
              border: `1px solid ${subjectsDropping > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <p style={{
                margin: 0,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: subjectsDropping > 0 ? '#fca5a5' : '#86efac',
                lineHeight: 1.5,
              }}>
                {leaveDays} leave day{leaveDays === 1 ? '' : 's'} · {missedTotal} class{missedTotal === 1 ? '' : 'es'} missed ·
                {subjectsDropping > 0
                  ? ` ${subjectsDropping} subject${subjectsDropping === 1 ? '' : 's'} drop below 75%`
                  : ' no subject drops below 75%'}
              </p>

              {assumeTill && leaveFrom && leaveTo && (
                <p style={{
                  margin: 0,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: W(0.5),
                  lineHeight: 1.5,
                }}>
                  Assumes you attend every class till{' '}
                  <span style={{ fontWeight: 800, color: W(0.75) }}>{displayDate(toDateStr(assumeTill))}</span>, then miss{' '}
                  {displayDate(leaveFrom)} – {displayDate(leaveTo)}
                </p>
              )}

              {overall && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: overall.below75 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  border: `1px solid ${overall.below75 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
                }}>
                  <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 700, color: overall.below75 ? '#fca5a5' : '#86efac' }}>
                    Projected overall: {overall.present} present · {overall.absent} absent · {overall.total} total →{' '}
                    <span style={{ fontWeight: 800 }}>{overall.percentage.toFixed(1)}%</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '0.74rem', fontWeight: 600, color: overall.below75 ? '#fca5a5' : '#86efac' }}>
                    {overall.below75 ? (
                      <>Attend <span style={{ fontWeight: 800 }}>{overall.mustAttend}</span> more class{overall.mustAttend === 1 ? '' : 'es'} to reach 75% (−{overall.margin.toFixed(1)}% margin)</>
                    ) : (
                      <>You can still skip <span style={{ fontWeight: 800 }}>{overall.canBunk}</span> more class{overall.canBunk === 1 ? '' : 'es'} (+{overall.margin.toFixed(1)}% margin)</>
                    )}
                  </p>
                </div>
              )}
              <button
                onClick={handleReset}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid var(--threshold-border)',
                  background: 'var(--threshold-surface)',
                  color: 'var(--threshold-text-dim)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset — show original attendance
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}