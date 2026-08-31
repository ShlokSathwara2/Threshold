"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  'Authenticating',
  'Fetching profile',
  'Loading dashboard',
] as const;

export default function LoginRedirect({ onDone }: { onDone?: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const iv = window.setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      setElapsed(sec);
      if (sec >= 1 && step < 0) setStep(1);
      if (sec >= 3 && step < 1) setStep(2);
      if (sec >= 5 && step < 2) setStep(3);
    }, 200);
    return () => window.clearInterval(iv);
  }, [step]);

  return (
    <AnimatePresence>
      <motion.div
        key="login-redirect"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090f',
        }}
      >
        {/* Animated gradient orbs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <motion.div
            animate={{
              x: [0, 80, -60, 0],
              y: [0, -60, 40, 0],
              scale: [1, 1.3, 0.9, 1],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: '30%',
              left: '30%',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <motion.div
            animate={{
              x: [0, -70, 50, 0],
              y: [0, 50, -40, 0],
              scale: [1, 0.8, 1.2, 1],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: '45%',
              right: '25%',
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(217,70,239,0.2) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
        </div>

        {/* Logo / spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '3px solid rgba(139,92,246,0.15)',
            borderTopColor: '#8b5cf6',
            marginBottom: '32px',
          }}
        />

        {/* App name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.5px',
            marginBottom: '6px',
          }}
        >
          Threshold
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: '40px',
          }}
        >
          Setting things up for you
        </motion.p>

        {/* Step indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '40px', width: '220px' }}>
          {STEPS.map((label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.2 }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {step > i ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(52,211,153,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.div>
                ) : step === i ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(139,92,246,0.25)',
                      border: '2px solid rgba(139,92,246,0.5)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.1)',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: step >= i ? 600 : 400,
                color: step > i ? '#34d399' : step === i ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
                transition: 'color 0.3s',
              }}>
                {label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{
          width: '220px',
          height: '3px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          marginBottom: '16px',
        }}>
          <motion.div
            animate={{ width: `${Math.min(100, ((step + 1) / STEPS.length) * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              height: '100%',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #8b5cf6, #d946ef)',
            }}
          />
        </div>

        {/* Timer */}
        <motion.span
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.3)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {elapsed}s
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );
}
