"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { isSpLoggedIn } from '@/lib/api';

const HelixMark = dynamic(() => import('@/components/splash/HelixMark'), { ssr: false });

const word = 'THRESHOLD'.split('');

export default function SplashPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => {
        router.replace(isSpLoggedIn() ? '/dashboard' : '/welcome');
      }, 650);
    }, 3400);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#05060d',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Starfield */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.16), transparent 55%),' +
            'radial-gradient(ellipse at 70% 80%, rgba(217,70,239,0.12), transparent 55%),' +
            'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.10), transparent 60%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '140px 140px, 70px 70px',
          backgroundPosition: '0 0, 35px 35px',
          opacity: 0.35,
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Helix mark */}
      <AnimatePresence>
        {!leaving && (
          <motion.div
            exit={{ opacity: 0, scale: 1.25, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: 'relative',
              width: 'min(78vw, 300px)',
              height: 'min(78vw, 300px)',
              zIndex: 2,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
              style={{
                position: 'absolute',
                inset: '6%',
                borderRadius: '50%',
                border: '1px solid rgba(139,92,246,0.25)',
                boxShadow: 'inset 0 0 60px rgba(139,92,246,0.15), 0 0 80px rgba(139,92,246,0.2)',
              }}
            />
            <HelixMark />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wordmark */}
      {!leaving && (
        <div style={{
          position: 'absolute',
          bottom: '18%',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          zIndex: 3,
          padding: '0 24px',
        }}>
          <motion.div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {word.map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 24, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: 0.12 + i * 0.06, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  fontSize: 'clamp(1.6rem, 7vw, 2.6rem)',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#fff',
                  textShadow: '0 0 24px rgba(139,92,246,0.8), 0 0 60px rgba(217,70,239,0.4)',
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: 1,
                }}
              >
                {ch}
              </motion.span>
            ))}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.4em' }}
            animate={{ opacity: 1, letterSpacing: '0.28em' }}
            transition={{ delay: 0.9, duration: 0.8 }}
            style={{
              margin: 0,
              fontSize: '0.62rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.55)',
              textTransform: 'uppercase',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Attendance · Exams · Insights
          </motion.p>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.1, duration: 0.8 }}
            style={{
              width: 'min(200px, 60vw)',
              height: 2,
              borderRadius: 999,
              background: 'linear-gradient(90deg, transparent, #8b5cf6, #d946ef, #3b82f6, transparent)',
              boxShadow: '0 0 20px rgba(139,92,246,0.6)',
            }}
          />
        </div>
      )}
    </div>
  );
}