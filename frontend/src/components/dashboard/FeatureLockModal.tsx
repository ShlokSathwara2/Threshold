"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

interface FeatureLockModalProps {
  show: boolean;
  onClose: () => void;
  feature?: string;
}

export default function FeatureLockModal({ show, onClose, feature }: FeatureLockModalProps) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '340px',
              borderRadius: '22px',
              background: theme.bgSoft,
              border: `1px solid ${WB(0.12)}`,
              boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${theme.accent}22`,
              padding: '28px 22px 22px',
              textAlign: 'center',
            }}
          >
            {/* Lock icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.35)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h2 style={{
              margin: 0,
              fontSize: '1.1rem',
              fontWeight: 800,
              color: theme.text,
              lineHeight: 1.3,
            }}>
              Feature not available on web
            </h2>

            <p style={{
              margin: '10px 0 0',
              fontSize: '0.78rem',
              color: W(0.5),
              lineHeight: 1.55,
            }}>
              SRM portal does not allow the website to access this data.
              {feature ? ` ${feature} requires` : ' This feature requires'} the Android app to work.
            </p>

            <p style={{
              margin: '14px 0 0',
              fontSize: '0.72rem',
              color: W(0.4),
              lineHeight: 1.5,
            }}>
              Download the APK to use all features including marks, profile, internal marks, course status, examination details and analytics.
            </p>

            <a
              href="https://github.com/ShlokSathwara2/Threshold_APK/raw/main/Threshold.apk"
              download="Threshold.apk"
              style={{
                display: 'block',
                marginTop: '18px',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: theme.accent,
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                textDecoration: 'none',
              }}
            >
              Download APK
            </a>

            <button
              onClick={onClose}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '8px',
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                background: 'transparent',
                color: W(0.45),
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
