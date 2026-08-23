"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

const STORAGE_KEY = 'threshold_welcome_seen';

const FEATURES = [
  { icon: '📊', title: 'Attendance Tracker', desc: 'Live attendance with recovery plans & bunk windows' },
  { icon: '📝', title: 'Marks & CGPA', desc: 'Internal marks, grade calculator & course status' },
  { icon: '📅', title: 'Exam Planner', desc: 'Exam timetable, hall ticket & countdown alerts' },
  { icon: '🔔', title: 'Smart Notifications', desc: 'Attendance-risk, class reminders & weekly reports' },
  { icon: '🔒', title: 'App Lock', desc: 'Biometric / PIN lock to keep your data safe' },
  { icon: '📥', title: 'Backup & Restore', desc: 'Export or import all your data as one file' },
];

export default function WelcomeModal() {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={dismiss}
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
              maxWidth: '380px',
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: '22px',
              background: theme.bgSoft,
              border: `1px solid ${WB(0.12)}`,
              boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${theme.accent}22`,
              padding: '28px 22px 22px',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto 14px',
                border: `2px solid ${theme.accent}55`,
                boxShadow: `0 8px 30px ${theme.glow}`,
              }}>
                <img
                  src="/about-photo.jpg"
                  alt="Shlok Sathwara"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <h2 style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 800,
                color: theme.text,
                lineHeight: 1.3,
              }}>
                Welcome to Threshold
              </h2>
              <p style={{
                margin: '8px 0 0',
                fontSize: '0.78rem',
                color: W(0.5),
                lineHeight: 1.55,
              }}>
                Hey! I&apos;m <strong style={{ color: theme.accentText }}>Shlok Sathwara</strong>, and I built this app
                because I was tired of doing attendance math in my head every semester.
              </p>
            </div>

            {/* Features */}
            <div style={{
              padding: '14px',
              borderRadius: '16px',
              background: WB(0.04),
              border: `1px solid ${WB(0.08)}`,
              marginBottom: '16px',
            }}>
              <p style={{
                margin: '0 0 10px',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: W(0.4),
              }}>
                What you get
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {FEATURES.map((f) => (
                  <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{f.icon}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: theme.text }}>
                        {f.title}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: W(0.45), lineHeight: 1.4 }}>
                        {f.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy + contact */}
            <p style={{
              margin: '0 0 16px',
              fontSize: '0.72rem',
              color: W(0.4),
              lineHeight: 1.55,
              textAlign: 'center',
            }}>
              Your password never leaves your device — everything runs locally.{' '}
              If you spot a bug or have feedback, reach me on{' '}
              <a
                href="https://www.instagram.com/_shlok_sathwara_/"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#e1306c', fontWeight: 700, textDecoration: 'none' }}
              >
                Instagram
              </a>{' '}
              or{' '}
              <a
                href="https://www.linkedin.com/in/shlok-sathwara-4b91ab319/"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#0a66c2', fontWeight: 700, textDecoration: 'none' }}
              >
                LinkedIn
              </a>{' '}
              — links are also in the About Me section.
            </p>

            {/* Dismiss */}
            <button
              onClick={dismiss}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '14px',
                border: 'none',
                background: theme.accent,
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Got it — let&apos;s go!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
