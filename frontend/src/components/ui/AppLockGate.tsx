"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { App } from '@capacitor/app';
import { BiometricLock, appLockEnabled } from '@/lib/applock';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

type GateState = 'idle' | 'locked' | 'unlocking' | 'error';

export default function AppLockGate() {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [state, setState] = useState<GateState>('idle');
  const [error, setError] = useState('');

  // Gate on launch: if the user enabled app lock, the app starts locked.
  useEffect(() => {
    if (appLockEnabled()) setState('locked');
  }, []);

  // Re-lock whenever the app goes to the background.
  useEffect(() => {
    let disposed = false;
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && appLockEnabled()) {
        setState('locked');
        setError('');
      }
    })
      .then((handle) => {
        if (disposed) handle.remove();
      })
      .catch(() => {
        /* not on native */
      });
    return () => {
      disposed = true;
    };
  }, []);

  const attemptUnlock = async () => {
    if (state === 'unlocking') return;
    setState('unlocking');
    setError('');
    try {
      await BiometricLock.authenticate({ reason: 'Unlock your semester data' });
      setState('idle');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'cancelled';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('not available')) {
        setState('locked');
        setError('Use the fingerprint, face or PIN you set up on this device.');
      } else {
        setState('locked');
        setError('Could not unlock right now — try again.');
      }
    }
  };

  return (
    <AnimatePresence>
      {state === 'locked' || state === 'unlocking' || state === 'error' ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: theme.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.9rem',
              background: theme.accentDim,
              border: `1px solid ${theme.accent}55`,
              boxShadow: `0 12px 40px ${theme.glow}, 0 0 30px ${theme.accent}33`,
              marginBottom: '22px',
            }}
          >
            🔒
          </motion.div>

          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: theme.text }}>
            Threshold is locked
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: W(0.5), maxWidth: '260px', lineHeight: 1.55 }}>
            Your attendance, marks and plans stay protected — unlock to continue.
          </p>

          {error && (
            <p style={{ margin: '12px 0 0', fontSize: '0.7rem', fontWeight: 600, color: '#fbbf24', maxWidth: '260px', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={attemptUnlock}
            disabled={state === 'unlocking'}
            style={{
              marginTop: '26px',
              padding: '14px 34px',
              borderRadius: '14px',
              border: 'none',
              background: theme.accent,
              color: '#fff',
              fontSize: '0.92rem',
              fontWeight: 800,
              cursor: state === 'unlocking' ? 'wait' : 'pointer',
              boxShadow: `0 8px 26px ${theme.accent}55`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {state === 'unlocking' ? 'Unlocking…' : 'Unlock'}
          </motion.button>

          <p style={{ margin: '16px 0 0', fontSize: '0.64rem', color: W(0.3), fontWeight: 600 }}>
            FINGERPRINT · FACE · DEVICE PIN
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}