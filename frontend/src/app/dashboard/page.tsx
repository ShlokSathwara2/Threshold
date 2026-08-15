"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isSpLoggedIn } from '@/lib/api';
import { useAttendance } from '@/hooks/useAttendance';
import GradesSummary from '@/components/grades/GradesSummary';
import InternalMarks from '@/components/grades/InternalMarks';

export default function DashboardPage() {
  const router = useRouter();
  const { subjects, overall, loading } = useAttendance();

  useEffect(() => {
    if (!isSpLoggedIn()) {
      router.push('/sp-login');
    }
  }, [router]);

  const overallColor = overall.overallPercentage >= 85 ? '#22c55e'
    : overall.overallPercentage >= 75 ? '#eab308'
    : overall.overallPercentage >= 60 ? '#f97316'
    : '#ef4444';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '24px' }}
      >
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'white',
          marginBottom: '4px',
        }}>
          Dashboard
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
          Quick glance at your academic standing
        </p>
      </motion.div>

      {/* Quick Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {/* Attendance Ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          onClick={() => router.push('/dashboard/attendance')}
          style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
            <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
              <motion.circle
                cx="32" cy="32" r="26" fill="none" stroke={overallColor} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 26}
                initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - overall.overallPercentage / 100) }}
                transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
              />
            </svg>
            <span style={{
              position: 'absolute',
              fontSize: '0.95rem',
              fontWeight: 800,
              color: overallColor,
            }}>
              {loading ? '—' : `${overall.overallPercentage.toFixed(0)}%`}
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 500 }}>
            Attendance
          </p>
        </motion.div>

        {/* Subjects at Risk */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}
        >
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            color: overall.subjectsBelowThreshold > 0 ? '#ef4444' : '#22c55e',
            marginBottom: '4px',
          }}>
            {loading ? '—' : overall.subjectsBelowThreshold}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 500 }}>
            Below 75%
          </p>
        </motion.div>

        {/* Total Classes */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}
        >
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            color: 'white',
            marginBottom: '4px',
          }}>
            {loading ? '—' : overall.totalClasses}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 500 }}>
            Total Classes
          </p>
        </motion.div>

        {/* Safe Subjects */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}
        >
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            color: '#22c55e',
            marginBottom: '4px',
          }}>
            {loading ? '—' : overall.subjectsSafe}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 500 }}>
            Safe (≥75%)
          </p>
        </motion.div>
      </div>

      {/* Quick Subject List */}
      {!loading && subjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
              Subjects at Risk
            </h2>
            <button
              onClick={() => router.push('/dashboard/attendance')}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b5cf6',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              View all →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subjects
              .filter(s => s.isBelowThreshold)
              .slice(0, 3)
              .map((subject, i) => (
                <motion.div
                  key={subject.courseCode}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  onClick={() => router.push('/dashboard/attendance')}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', margin: 0 }}>
                      {subject.courseTitle.length > 30 ? subject.courseTitle.slice(0, 28) + '…' : subject.courseTitle}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                      {subject.courseCode} • {subject.facultyName}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: subject.percentage >= 60 ? '#f97316' : '#ef4444',
                  }}>
                    {subject.percentage.toFixed(1)}%
                  </span>
                </motion.div>
              ))}

            {subjects.filter(s => s.isBelowThreshold).length === 0 && (
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.06)',
                border: '1px solid rgba(34, 197, 94, 0.15)',
                textAlign: 'center',
              }}>
                <p style={{ color: '#86efac', fontSize: '0.85rem', fontWeight: 500 }}>
                  All subjects above 75% — you&apos;re safe!
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Grades & Internal Marks */}
      <GradesSummary />
      <InternalMarks />

    </div>
  );
}
