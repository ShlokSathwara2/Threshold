"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const FEATURE_VERSION = '2.5.0';
const STORAGE_KEY = 'threshold_feature_announcement_seen';

export default function FeatureAnnouncement() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== FEATURE_VERSION) {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, FEATURE_VERSION); } catch {}
    setShow(false);
  };

  const goToStep = () => {
    dismiss();
    router.push('/dashboard/step');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '20px',
          }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '340px',
              borderRadius: '22px',
              background: 'linear-gradient(160deg, rgba(20,20,40,0.95), rgba(10,10,25,0.98))',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.15)',
              padding: '28px 24px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Glow background */}
            <div style={{
              position: 'absolute',
              top: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', damping: 12 }}
              style={{
                fontSize: '2.2rem',
                marginBottom: '12px',
              }}
            >
              📅
            </motion.div>

            <h2 style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#fff',
              margin: '0 0 6px',
            }}>
              Class Scheduler is here!
            </h2>

            <p style={{
              fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.5)',
              margin: '0 0 18px',
              lineHeight: 1.5,
            }}>
              Schedule your STEP and Aptitude classes — pick your days and times, get reminded 15 minutes before each class. Never miss a session!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={goToStep}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(6,182,212,0.4)',
                }}
              >
                Open Scheduler
              </button>
              <button
                onClick={dismiss}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
