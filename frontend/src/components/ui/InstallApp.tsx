"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { isNativePlatform } from '@/lib/capacitor';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/mac os/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export default function InstallApp({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isNativePlatform()) return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (isIOS()) setIosHint(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (isNativePlatform() || installed) return null;

  const onInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    }
  };

  const styles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(82, 39, 255, 0.22), rgba(255, 159, 252, 0.12))',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    color: theme.text,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={deferred ? onInstall : () => setIosHint(true)}
        style={styles}
      >
        <span style={{
          flexShrink: 0,
          width: '38px',
          height: '38px',
          borderRadius: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(139, 92, 246, 0.2)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          fontSize: '1rem',
        }}>
          ⬇
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700 }}>
            {deferred ? 'Install Threshold as an app' : 'Download Threshold as an app'}
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', color: W(0.5), marginTop: '1px' }}>
            {deferred
              ? 'One tap — works offline, opens full-screen like the APK'
              : isIOS()
                ? 'Tap Share → Add to Home Screen → Add'
                : 'Install prompt will appear — tap Install'}
          </span>
        </span>
        <span style={{ flexShrink: 0, fontSize: '0.8rem', color: '#c4b5fd' }}>↓</span>
      </motion.button>

      <AnimatePresence>
        {iosHint && !deferred && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px',
            }}
            onClick={() => setIosHint(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '340px',
                padding: '22px',
                borderRadius: '20px',
                background: theme.bgSoft,
                border: `1px solid ${WB(0.1)}`,
                textAlign: 'center',
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '18px',
                margin: '0 auto 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                background: theme.accentDim,
                border: `1px solid ${theme.accent}44`,
              }}>
                📲
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: theme.text }}>
                Install Threshold on iPhone
              </h3>
              <ol style={{
                margin: '14px 0 0',
                padding: '0 0 0 20px',
                textAlign: 'left',
                fontSize: '0.8rem',
                color: W(0.6),
                lineHeight: 2,
              }}>
                <li>Tap the <strong style={{ color: theme.text }}>Share</strong> button in Safari</li>
                <li>Scroll and tap <strong style={{ color: theme.text }}>Add to Home Screen</strong></li>
                <li>Tap <strong style={{ color: theme.text }}>Add</strong> — done, it opens full-screen like an app</li>
              </ol>
              <button
                onClick={() => setIosHint(false)}
                style={{
                  marginTop: '18px',
                  padding: '11px 30px',
                  borderRadius: '12px',
                  border: 'none',
                  background: theme.accent,
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}