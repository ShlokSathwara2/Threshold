"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, overlayBg } from '@/lib/theme';
import { isNativePlatform } from '@/lib/capacitor';

// Check if browser notifications are supported and not yet granted
function canRequest(): boolean {
  if (isNativePlatform()) return false;
  if (!('Notification' in window)) return false;
  return Notification.permission === 'default';
}

function dismissedKey(): string {
  return 'threshold_notif_banner_dismissed';
}

function wasDismissed(): boolean {
  try { return sessionStorage.getItem(dismissedKey()) === '1'; } catch { return false; }
}

function markDismissed() {
  try { sessionStorage.setItem(dismissedKey(), '1'); } catch { /* ignore */ }
}

export default function NotificationPermissionBanner() {
  const { theme } = useTheme();
  const WB = (a: number) => overlayBg(theme, a);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Delay showing the banner so it doesn't fight with other UI
    const timer = setTimeout(() => {
      if (canRequest() && !wasDismissed()) setShow(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = async () => {
    try {
      await Notification.requestPermission();
    } catch { /* ignore */ }
    setShow(false);
  };

  const handleDismiss = () => {
    markDismissed();
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          style={{
            margin: '0 20px 12px',
            padding: '14px 16px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.12), rgba(var(--threshold-accent-rgb),0.04))`,
            border: `1px solid rgba(var(--threshold-accent-rgb),0.2)`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--threshold-text)',
              margin: 0,
            }}>
              Enable notifications?
            </p>
            <p style={{
              fontSize: '0.68rem',
              color: 'rgba(255,255,255,0.45)',
              margin: '3px 0 0',
            }}>
              Get reminders for classes, exams, and attendance alerts.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleDismiss}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Later
            </button>
            <button
              onClick={handleAllow}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.8), rgba(var(--threshold-accent-rgb),0.6))',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Allow
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
