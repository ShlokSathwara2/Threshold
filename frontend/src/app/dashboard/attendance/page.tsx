"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn } from '@/lib/api';
import { useAttendance } from '@/hooks/useAttendance';
import AttendanceSummary from '@/components/attendance/AttendanceSummary';
import SubjectAttendanceCard from '@/components/attendance/SubjectAttendanceCard';

export default function AttendancePage() {
  const router = useRouter();
  const { subjects, overall, loading, error, refetch } = useAttendance();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
    }
  }, [router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        gap: '16px',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(139, 92, 246, 0.2)',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
          }}
        />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
          Fetching attendance data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60dvh',
        gap: '16px',
        padding: '20px',
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: '12px' }}>
            {error}
          </p>
          <button
            onClick={refetch}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '20px' }}
      >
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'white',
          marginBottom: '4px',
        }}>
          Attendance
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
          {subjects.length} subjects tracked • Sorted by risk (lowest margin first)
        </p>
      </motion.div>

      {/* Overall Summary */}
      <AttendanceSummary stats={overall} />

      {/* Subject Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {subjects.map((subject, i) => (
          <SubjectAttendanceCard key={subject.courseCode} subject={subject} index={i} />
        ))}
      </div>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          onClick={refetch}
          style={{
            padding: '10px 28px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}
