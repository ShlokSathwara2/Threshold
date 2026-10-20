"use client";

import { motion } from 'framer-motion';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import type { LiveAlert, LiveAlertKind } from '@/lib/live-alerts';

const KIND_META: Record<
  LiveAlertKind,
  { icon: string; color: string; label: string }
> = {
  'marks-new': { icon: '📊', color: '#a78bfa', label: 'Marks' },
  'marks-updated': { icon: '📈', color: '#a78bfa', label: 'Marks' },
  'attendance-low': { icon: '⚠️', color: '#f87171', label: 'Low attendance' },
  'attendance-absent': { icon: '✕', color: '#f87171', label: 'Attendance' },
  'attendance-present': { icon: '✓', color: '#34d399', label: 'Attendance' },
};

function timeAgo(at: number): string {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/**
 * In-app history of the live alerts detected today. Complements the system
 * notifications: if the student misses a ping (or has notifications muted),
 * the change is still visible here on the dashboard.
 */
export default function LiveAlertsFeed({
  alerts,
  onClear,
  onTap,
}: {
  alerts: LiveAlert[];
  onClear: () => void;
  onTap: (alert: LiveAlert) => void;
}) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  if (alerts.length === 0) return null;

  const newestFirst = [...alerts].sort((a, b) => b.at - a.at).slice(0, 8);
  const now = Date.now();
  const hasFresh = newestFirst.some((a) => now - a.at < 3 * 60_000);

  return (
    <motion.div
      className="thr-gradient-border"
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: hasFresh
          ? [
              '0 0 0 rgba(52,211,153,0)',
              '0 0 26px rgba(52,211,153,0.22)',
              '0 0 0 rgba(52,211,153,0)',
            ]
          : '0 0 0 rgba(0,0,0,0)',
      }}
      transition={{
        opacity: { duration: 0.35, ease: [0.23, 1, 0.32, 1] },
        y: { duration: 0.35, ease: [0.23, 1, 0.32, 1] },
        boxShadow: hasFresh
          ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 },
      }}
      style={{
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: `1px solid ${WB(0.07)}`,
        overflow: 'hidden',
        marginBottom: '14px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* One-shot shine sweep as the feed appears / gets a new alert. */}
      <motion.div
        aria-hidden
        initial={{ x: '-140%' }}
        animate={{ x: '260%' }}
        transition={{ duration: 1.5, delay: 0.15, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '42%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${WB(0.05)}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <motion.span
          animate={{ scale: [1, 1.18, 1], opacity: [1, 0.75, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52,211,153,0.7)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--threshold-text)',
          }}
        >
          Live alerts
        </span>
        <span
          style={{
            fontSize: '0.58rem',
            fontWeight: 700,
            color: W(0.4),
            padding: '2px 8px',
            borderRadius: '999px',
            background: WB(0.05),
            border: `1px solid ${WB(0.07)}`,
          }}
        >
          Today · {alerts.length}
        </span>
        <button
          onClick={onClear}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.62rem',
            fontWeight: 700,
            color: W(0.35),
            padding: '2px 4px',
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {newestFirst.map((alert, i) => {
          const meta = KIND_META[alert.kind];
          const fresh = now - alert.at < 3 * 60_000;
          return (
            <motion.button
              key={alert.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => onTap(alert)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom:
                  i < newestFirst.length - 1 ? `1px solid ${WB(0.04)}` : 'none',
                cursor: alert.href ? 'pointer' : 'default',
                textAlign: 'left',
                width: '100%',
              }}
              whileTap={{ scale: 0.99 }}
            >
              <motion.span
                animate={fresh ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                transition={fresh ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  color: meta.color,
                  background: `${meta.color}18`,
                  border: `1px solid ${meta.color}33`,
                  flexShrink: 0,
                }}
              >
                {meta.icon}
              </motion.span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {alert.code && (
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        color: meta.color,
                        background: `${meta.color}16`,
                        padding: '1px 6px',
                        borderRadius: '5px',
                        flexShrink: 0,
                      }}
                    >
                      {alert.code}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--threshold-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {alert.title}
                  </span>
                </div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.66rem',
                    color: W(0.45),
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {alert.body}
                </span>
              </div>

              {fresh && (
                <motion.span
                  animate={{ opacity: [1, 0.55, 1], scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    fontSize: '0.52rem',
                    fontWeight: 900,
                    letterSpacing: '0.4px',
                    color: '#052e16',
                    background: 'linear-gradient(135deg, #86efac, #34d399)',
                    padding: '2px 6px',
                    borderRadius: '999px',
                    flexShrink: 0,
                  }}
                >
                  NEW
                </motion.span>
              )}
              <span
                style={{
                  fontSize: '0.58rem',
                  color: W(0.3),
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {timeAgo(alert.at)}
              </span>
              {alert.href && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={WB(0.22)}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
