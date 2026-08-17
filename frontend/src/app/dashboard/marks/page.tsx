"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isLoggedIn } from '@/lib/api';
import { useResults } from '@/hooks/useResults';
import { useSubjectMarks } from '@/hooks/useSubjectMarks';
import SubjectMarksCard from '@/components/marks/SubjectMarksCard';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

const GRADE_COLORS: Record<string, string> = {
  O: '#34d399',
  'A+': '#4ade80',
  A: '#a3e635',
  'B+': '#facc15',
  B: '#fb923c',
  C: '#f87171',
  F: '#ef4444',
  W: '#94a3b8',
};

function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] || '#94a3b8';
}

function Spinner() {
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
          borderTopColor: 'var(--threshold-accent)',
          borderRadius: '50%',
        }}
      />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
        Fetching resultsâ€¦
      </p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
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
          onClick={onRetry}
          style={{
            padding: '10px 24px',
            borderRadius: '10px',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            background: 'rgba(139, 92, 246, 0.15)',
            color: 'var(--threshold-accent-text)',
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

export default function MarksPage() {
  const router = useRouter();
  const { semesters, cgpa, creditsRegistered, creditsEarned, creditsRequired, loading, error, refetch } = useResults();
  const { marks: subjectMarks, loading: marksLoading, error: marksError, semester, refetch: refetchMarks } = useSubjectMarks();
  usePullToRefresh(async () => {
    await Promise.all([refetch(), refetchMarks()]);
  });

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
    }
  }, [router]);

  if (loading) return <Spinner />;

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  if (!cgpa && semesters.length === 0) {
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
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <p style={{ color: 'var(--threshold-accent-text)', fontSize: '0.9rem', marginBottom: '12px' }}>
            No marks have been uploaded yet. Results will appear here once your exams are graded.
          </p>
          <button
            onClick={refetch}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--threshold-accent-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '20px' }}
      >
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'var(--threshold-text)',
          marginBottom: '4px',
        }}>
          Marks & Results
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          {semesters.length} semester{semesters.length === 1 ? '' : 's'} of grades tracked
        </p>
      </motion.div>

      {/* CGPA Hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          padding: '28px 24px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(139, 92, 246, 0.08))',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          marginBottom: '16px',
          textAlign: 'center',
        }}
      >
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: '6px',
        }}>
          Cumulative GPA
        </p>
        <p style={{
          fontSize: '3.2rem',
          fontWeight: 800,
          lineHeight: 1,
          background: 'linear-gradient(135deg, var(--threshold-accent-text), var(--threshold-accent), #f0abfc)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {cgpa !== null ? cgpa.toFixed(2) : 'â€”'}
        </p>
      </motion.div>

      {/* Credits Row */}
      {(creditsRegistered !== null || creditsEarned !== null) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '20px',
        }}>
          {[
            { label: 'Registered', value: creditsRegistered },
            { label: 'Earned', value: creditsEarned },
            { label: 'Required', value: creditsRequired },
          ].map((c) => (
            <div key={c.label} style={{
              padding: '14px 10px',
              borderRadius: '14px',
              background: 'var(--threshold-surface)',
              border: '1px solid var(--threshold-border)',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--threshold-text)',
              }}>
                {c.value ?? 'â€”'}
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.68rem',
                marginTop: '2px',
              }}>
                {c.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Subject Marks & Grade Targets */}
      <div style={{ marginTop: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
              Subject Marks &amp; Grade Predictor
            </h2>
            {typeof semester === 'number' && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'rgba(139, 92, 246, 0.12)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                fontSize: '0.66rem',
                fontWeight: 600,
                color: 'var(--threshold-accent-text)',
              }}>
                Sem {semester}
              </span>
            )}
          </div>
          {marksError && (
            <button
              onClick={refetchMarks}
              style={{
                background: 'none',
                border: 'none',
                color: '#fca5a5',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </div>

        {marksLoading ? (
          <div style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--threshold-surface)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
              Fetching subject marksâ€¦
            </p>
          </div>
        ) : marksError ? (
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: '10px' }}>
              {marksError}
            </p>
            <button
              onClick={refetchMarks}
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#fca5a5',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : subjectMarks.length === 0 ? (
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'var(--threshold-surface)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
              No subject marks available yet. As tests are entered in the portal, the chart and grade targets update live.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {subjectMarks.map((m, i) => (
              <SubjectMarksCard key={m.courseCode} subject={m} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Semester Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
        {semesters.map((sem, i) => (
          <motion.div
            key={sem.semester}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              borderRadius: '16px',
              background: 'var(--threshold-surface)',
              border: '1px solid var(--threshold-border)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{
                color: 'var(--threshold-text)',
                fontWeight: 700,
                fontSize: '0.95rem',
              }}>
                Semester {sem.semester}
              </span>
              <span style={{
                color: sem.sgpa !== null ? 'var(--threshold-accent-text)' : 'var(--threshold-text-faint)',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}>
                {sem.sgpa !== null ? `SGPA ${sem.sgpa.toFixed(3)}` : 'â€”'}
              </span>
            </div>

            {sem.grades.length === 0 ? (
              <p style={{
                color: 'var(--threshold-text-faint)',
                fontSize: '0.8rem',
                padding: '16px',
                textAlign: 'center',
              }}>
                No marks uploaded yet
              </p>
            ) : (
              <div>
                {sem.grades.map((g) => (
                  <div key={`${sem.semester}-${g.code}`} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{
                      minWidth: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      color: gradeColor(g.grade),
                      background: `${gradeColor(g.grade)}1a`,
                      border: `1px solid ${gradeColor(g.grade)}40`,
                    }}>
                      {g.grade}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: 'var(--threshold-text)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {g.description}
                      </p>
                      <p style={{
                        color: 'var(--threshold-text-faint)',
                        fontSize: '0.72rem',
                        marginTop: '2px',
                      }}>
                        {g.code}
                      </p>
                    </div>
                    <span style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: '0.72rem',
                      whiteSpace: 'nowrap',
                    }}>
                      {g.credit} cr
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.25)',
        fontSize: '0.72rem',
        textAlign: 'center',
        marginTop: '20px',
      }}>
        Current semester marks appear once uploaded.
      </p>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        <button
          onClick={refetch}
          style={{
            padding: '10px 28px',
            borderRadius: '10px',
            border: '1px solid var(--threshold-border)',
            background: 'var(--threshold-surface)',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          â†» Refresh
        </button>
      </div>
    </div>
  );
}