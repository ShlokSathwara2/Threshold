"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { dismissUpdate, type UpdateInfo } from '@/lib/update-check';
import { FileBridge } from '@/lib/backup';

interface Props {
  info: UpdateInfo | null;
  onClose: () => void;
}

export default function UpdatePrompt({ info, onClose }: Props) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [status, setStatus] = useState<'idle' | 'downloading' | 'done'>('idle');

  if (!info) return null;

  const handleUpdate = async () => {
    try {
      setStatus('downloading');
      await FileBridge.downloadAndInstall({
        url: info.apkUrl,
        filename: 'Threshold.apk',
      });
      setStatus('done');
    } catch {
      // Native downloader unavailable (e.g. web preview) — open the APK page.
      setStatus('idle');
      window.open(info.apkUrl, '_blank');
      onClose();
      return;
    }
    onClose();
  };

  const handleLater = () => {
    void dismissUpdate(info.version);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={{
            width: '100%',
            maxWidth: '340px',
            borderRadius: '20px',
            padding: '24px 20px',
            background: WB(0.12),
            border: `1px solid ${WB(0.16)}`,
            boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${theme.glow}`,
            textAlign: 'center',
          }}
        >
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, 6, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 14px',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.7rem',
              background: 'linear-gradient(135deg, rgba(var(--threshold-accent-rgb),0.35), rgba(59,130,246,0.25))',
              border: '1px solid rgba(var(--threshold-accent-rgb),0.45)',
              boxShadow: '0 0 24px rgba(var(--threshold-accent-rgb),0.35)',
            }}
          >
            ⬆️
          </motion.div>

          <h2 style={{
            margin: 0,
            fontSize: '1.15rem',
            fontWeight: 800,
            color: theme.text,
          }}>
            New version available
          </h2>
          <p style={{
            margin: '4px 0 0',
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--threshold-accent-text)',
            letterSpacing: '0.3px',
          }}>
            v{info.version}
          </p>

          {info.note && (
            <p style={{
              margin: '12px 0 0',
              fontSize: '0.78rem',
              color: W(0.6),
              lineHeight: 1.55,
            }}>
              {info.note}
            </p>
          )}

          <p style={{
            margin: '10px 0 0',
            fontSize: '0.66rem',
            color: W(0.4),
            lineHeight: 1.5,
          }}>
            {status === 'downloading'
              ? 'Downloading — Android will install it once it finishes.'
              : 'Tap update — it downloads and installs on its own.'}
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button
              onClick={handleLater}
              disabled={status === 'downloading'}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: '12px',
                border: `1px solid ${WB(0.12)}`,
                background: WB(0.05),
                color: W(0.55),
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: status === 'downloading' ? 'wait' : 'pointer',
                opacity: status === 'downloading' ? 0.5 : 1,
              }}
            >
              Later
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleUpdate}
              disabled={status === 'downloading'}
              style={{
                flex: 1.4,
                padding: '12px 0',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(120deg, #7c3aed, #d946ef)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: status === 'downloading' ? 'wait' : 'pointer',
                opacity: status === 'downloading' ? 0.6 : 1,
                boxShadow: '0 8px 24px rgba(139,92,246,0.4)',
              }}
            >
              {status === 'downloading' ? 'Downloading…' : 'Update now'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
