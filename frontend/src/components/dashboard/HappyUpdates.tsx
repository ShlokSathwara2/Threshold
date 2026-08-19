"use client";

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TimetableSlot } from '@/lib/api';
import type { SubjectAttendance } from '@/lib/attendance-calculator';
import { computeConsequences, computeDayRecommendations } from '@/lib/bunk-planner';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

interface Props {
  subjects: SubjectAttendance[];
  schedule: TimetableSlot[];
  todaySlotsFuture: TimetableSlot[];
  todayDO: string | null;
  optedOut?: Set<string>;
  onOpenTimetable: () => void;
  onOpenAttendance: () => void;
  onOpenExams: () => void;
}

export default function HappyUpdates({
  subjects,
  schedule,
  todaySlotsFuture,
  todayDO,
  optedOut,
  onOpenTimetable,
  onOpenAttendance,
  onOpenExams,
}: Props) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  const recs = useMemo(
    () => computeDayRecommendations(schedule, subjects, optedOut),
    [schedule, subjects, optedOut]
  );
  const safeDays = recs.filter((r) => r.hasClasses && r.safe);
  const unknownDays = recs.filter((r) => r.hasClasses && r.unknown);
  const consequences = useMemo(
    () => computeConsequences(todaySlotsFuture, subjects, optedOut),
    [todaySlotsFuture, subjects, optedOut]
  );
  const spareSubjects = useMemo(
    () => [...subjects].filter((s) => s.canBunk > 0).sort((a, b) => b.canBunk - a.canBunk).slice(0, 4),
    [subjects]
  );
  const hasSchedule = schedule.some((s) => s.courseCode && s.day);

  if (!hasSchedule || subjects.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      style={{
        position: 'relative',
        zIndex: 1,
        borderRadius: '18px',
        background: 'linear-gradient(165deg, rgba(34,197,94,0.05), rgba(139,92,246,0.02))',
        border: '1px solid rgba(34,197,94,0.14)',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '14px 16px',
        borderBottom: `1px solid ${WB(0.05)}`,
      }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
          Happy updates
        </h2>
        <span style={{ color: '#4ade80', fontSize: '0.95rem' }}>✨</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {safeDays.length > 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: `1px solid ${WB(0.04)}`,
          }}>
            <span style={{
              flexShrink: 0,
              width: '30px',
              height: '30px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(34,197,94,0.14)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#4ade80',
              fontSize: '0.95rem',
            }}>
              🎉
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--threshold-text)' }}>
                You can skip class on {safeDays.map((d) => d.day).join(', ')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: W(0.45), lineHeight: 1.4 }}>
                Every class that day stays above 75% — but skip wisely; it uses your spare margin.
              </p>
            </div>
            <button
              onClick={onOpenTimetable}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: '#4ade80',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              View →
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: `1px solid ${WB(0.04)}`,
          }}>
            <span style={{
              flexShrink: 0,
              width: '30px',
              height: '30px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(245,158,11,0.13)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#fbbf24',
              fontSize: '0.95rem',
            }}>
              📌
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--threshold-text)' }}>
                No safe days this week
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: W(0.45), lineHeight: 1.4 }}>
                {unknownDays.length > 0
                  ? 'Attendance data is missing for some subjects — log in to SP to get exact margins.'
                  : 'Every day has at least one must-attend class. Protect your 75%.'}
              </p>
            </div>
            <button
              onClick={onOpenAttendance}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                color: '#fbbf24',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Check →
            </button>
          </div>
        )}

        {spareSubjects.length > 0 && (
          <div style={{ padding: '10px 16px 12px' }}>
            <p style={{
              margin: '0 0 8px',
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: W(0.35),
            }}>
              Spare classes by subject
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {spareSubjects.map((s) => (
                <div key={s.courseCode} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <span style={{
                    flexShrink: 0,
                    width: '52px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: W(0.6),
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {s.courseCode}
                  </span>
                  <div style={{
                    flex: 1,
                    height: '6px',
                    borderRadius: '999px',
                    background: WB(0.05),
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, s.canBunk)}%` }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      style={{
                        height: '100%',
                        borderRadius: '999px',
                        background: s.canBunk >= 5
                          ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                          : s.canBunk >= 2
                            ? 'linear-gradient(90deg, #eab308, #facc15)'
                            : 'linear-gradient(90deg, #f97316, #fb923c)',
                      }}
                    />
                  </div>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    color: s.canBunk >= 5 ? '#4ade80' : s.canBunk >= 2 ? '#facc15' : '#fb923c',
                    width: '22px',
                    textAlign: 'right',
                  }}>
                    {s.canBunk}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {consequences.length > 0 && (
          <div style={{
            padding: '10px 16px 12px',
            borderTop: `1px solid ${WB(0.04)}`,
          }}>
            <p style={{
              margin: '0 0 8px',
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: W(0.35),
            }}>
              {todayDO ? `Skipping ${todayDO} classes` : 'Skipping today'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {consequences.slice(0, 3).map((c) => (
                <div key={c.courseCode} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.7rem',
                }}>
                  <span style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    background: c.dropsBelow75 ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.1)',
                    border: `1px solid ${c.dropsBelow75 ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.25)'}`,
                    color: c.dropsBelow75 ? '#f87171' : W(0.65),
                  }}>
                    {c.courseCode}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, color: W(0.5), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.courseTitle}
                  </span>
                  <span style={{
                    flexShrink: 0,
                    fontWeight: 800,
                    color: c.dropsBelow75 ? '#f87171' : '#4ade80',
                  }}>
                    {c.wouldDropTo.toFixed(1)}%
                  </span>
                </div>
              ))}
              {consequences.length > 3 && (
                <p style={{ margin: 0, fontSize: '0.62rem', color: W(0.35) }}>
                  +{consequences.length - 3} more
                </p>
              )}
              <button
                onClick={onOpenExams}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '4px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--threshold-accent-text)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Check exams →
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}