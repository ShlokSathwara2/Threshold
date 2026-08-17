"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchSpGrades, type GradesResponse, type SemesterGrades } from '@/lib/api';

export default function GradesSummary({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<GradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSem, setExpandedSem] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSpGrades();
        if (!cancelled) setData(res);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load grades');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Loading grades...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
      }}>
        <p style={{ color: '#fca5a5', fontSize: '0.8rem' }}>{error}</p>
      </div>
    );
  }

  if (!data || data.semesters.length === 0) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>No grades data available</p>
      </div>
    );
  }

  const latestSem = data.semesters[data.semesters.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '24px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
          Grades
        </h2>
        {data.cgpa !== null && (
          <div style={{
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(139, 92, 246, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--threshold-accent-text)' }}>
              CGPA: {data.cgpa.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* CGPA Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--threshold-surface)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--threshold-accent-text)', marginBottom: '2px' }}>
            {data.cgpa?.toFixed(2) ?? 'â€”'}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>CGPA</p>
        </div>
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--threshold-surface)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22c55e', marginBottom: '2px' }}>
            {data.credits_earned ?? 'â€”'}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>Earned</p>
        </div>
        <div style={{
          padding: '12px',
          borderRadius: '12px',
          background: 'var(--threshold-surface)',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
            {data.credits_registered ?? 'â€”'}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>Registered</p>
        </div>
      </div>

      {/* Semester List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[...data.semesters].reverse().map((sem) => (
          <SemesterRow
            key={sem.semester}
            sem={sem}
            expanded={expandedSem === sem.semester}
            onToggle={() => setExpandedSem(expandedSem === sem.semester ? null : sem.semester)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function SemesterRow({ sem, expanded, onToggle }: { sem: SemesterGrades; expanded: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 14px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: expanded ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.02)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--threshold-text)' }}>
            Semester {sem.semester}
          </span>
          {sem.sgpa !== null && (
            <span style={{
              marginLeft: '10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--threshold-accent-text)',
            }}>
              SGPA: {sem.sgpa.toFixed(2)}
            </span>
          )}
        </div>
        <span style={{
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.3)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s',
        }}>
          â–¼
        </span>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{ padding: '8px 0 4px' }}
        >
          {sem.grades.map((g, i) => (
            <div
              key={`${g.code}-${i}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 14px',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{g.code}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 6px' }}>Â·</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>
                  {g.description.length > 25 ? g.description.slice(0, 23) + 'â€¦' : g.description}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>
                  {g.credit} cr
                </span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '8px',
                  background: gradeColor(g.grade),
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--threshold-text)',
                }}>
                  {g.grade}
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function gradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g === 'O' || g === 'A+') return 'rgba(34, 197, 94, 0.3)';
  if (g === 'A' || g === 'A+' || g === 'B+') return 'rgba(34, 197, 94, 0.2)';
  if (g === 'B' || g === 'B+' || g === 'C+') return 'rgba(234, 179, 8, 0.2)';
  if (g === 'C' || g === 'D') return 'rgba(249, 115, 22, 0.2)';
  return 'rgba(239, 68, 68, 0.2)';
}
