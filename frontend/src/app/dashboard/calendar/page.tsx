"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn } from '@/lib/api';

export default function CalendarPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
          Calendar
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
          Academic planner
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          padding: '28px 20px',
          borderRadius: '18px',
          background: 'linear-gradient(160deg, rgba(139, 92, 246, 0.08), rgba(255,255,255,0.02))',
          border: '1px solid rgba(139, 92, 246, 0.18)',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          margin: '0 auto 14px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(139, 92, 246, 0.15)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          fontSize: '1.5rem',
        }}>
          📅
        </div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: '0 0 6px' }}>
          Academic calendar coming soon
        </h2>
        <p style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.78rem',
          lineHeight: 1.6,
          maxWidth: '320px',
          margin: '0 auto',
        }}>
          Exam schedules, holidays and important dates will appear here once academia calendar
          support lands.
        </p>
      </motion.div>
    </div>
  );
}