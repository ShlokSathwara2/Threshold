"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SubjectAttendance } from '@/lib/attendance-calculator';
import { displayDate, type LeaveProjection, type ReachPlan } from '@/lib/day-order';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

interface Props {
  subject: SubjectAttendance;
  index: number;
  dayOrders?: Map<string, number>;
  reachPlan?: ReachPlan | null;
  projection?: LeaveProjection | null;
  projectedReachPlan?: ReachPlan | null;
}

const statusColors: Record<SubjectAttendance['status'], { bg: string; border: string; text: string; accent: string }> = {
  safe: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', accent: '#22c55e' },
  warning: { bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.2)', text: '#eab308', accent: '#eab308' },
  danger: { bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.2)', text: '#f97316', accent: '#f97316' },
  critical: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', accent: '#ef4444' },
};

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  const { theme } = useTheme();
  const WB = (a: number) => overlayBg(theme, a);
  return (
    <div style={{
      width: '100%',
      height: '4px',
      borderRadius: '2px',
      background: WB(0.06),
      overflow: 'hidden',
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percentage, 100)}%` }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
        style={{
          height: '100%',
          borderRadius: '2px',
          background: color,
        }}
      />
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color?: string }) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      padding: '6px 10px',
      borderRadius: '8px',
      background: WB(0.03),
      minWidth: '48px',
    }}>
      <span style={{ fontSize: '0.65rem', color: W(0.35), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: color || theme.text }}>
        {value}
      </span>
    </div>
  );
}

export default function SubjectAttendanceCard({ subject, index, dayOrders, reachPlan, projection, projectedReachPlan }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const colors = statusColors[subject.status];

  const projected = projection && (projection.missed > 0 || projection.attendedBefore > 0) ? projection : null;

  const shortTitle = subject.courseTitle.length > 28
    ? subject.courseTitle.slice(0, 26) + '…'
    : subject.courseTitle;

  const doList = dayOrders && dayOrders.size > 0
    ? [...dayOrders.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      onClick={() => setExpanded(!expanded)}
      className="thr-gradient-border"
      style={{
        padding: '16px',
        borderRadius: '14px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: colors.text,
              background: `${colors.text}15`,
              padding: '2px 8px',
              borderRadius: '6px',
              letterSpacing: '0.3px',
            }}>
              {subject.courseCode}
            </span>
          </div>
          <h3 style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: theme.text,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {shortTitle}
          </h3>
          <p style={{ fontSize: '0.7rem', color: W(0.3), margin: '2px 0 0' }}>
            {subject.facultyName}
          </p>
          <p style={{
            fontSize: '0.66rem',
            color: W(0.35),
            margin: '3px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            flexWrap: 'wrap',
          }}>
            {[
              subject.slot ? `Slot ${subject.slot}` : null,
              subject.room && subject.room !== 'N/A' ? `Room ${subject.room}` : null,
              subject.credit && subject.credit !== 'N/A' ? `${subject.credit} cr` : null,
              subject.slotType || subject.courseType || null,
            ].filter(Boolean).map((chip) => (
              <span
                key={chip}
                style={{
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: WB(0.05),
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontWeight: 500,
                }}
              >
                {chip}
              </span>
            ))}
          </p>
        </div>

        {/* Percentage Badge */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          flexShrink: 0,
        }}>
          <div style={{
            padding: '6px 12px',
            borderRadius: '10px',
            background: projected ? `${projected.dropsBelow75 ? '#ef4444' : '#22c55e'}1f` : `${colors.text}18`,
            border: `1px solid ${projected ? (projected.dropsBelow75 ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)') : `${colors.text}30`}`,
          }}>
            <span style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: projected ? (projected.dropsBelow75 ? '#ef4444' : '#22c55e') : colors.text,
            }}>
              {(projected ? projected.projectedPercentage : subject.percentage).toFixed(1)}%
            </span>
          </div>
          {projected && (
            <span style={{
              fontSize: '0.56rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: projected.dropsBelow75 ? '#ef4444' : '#22c55e',
            }}>
              AFTER LEAVE
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar percentage={subject.percentage} color={colors.accent} />

      {/* Stat Pills */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
        <StatPill label="Present" value={projected ? projected.projectedPresent : subject.present} color="#22c55e" />
        <StatPill label="Absent" value={projected ? projected.projectedAbsent : subject.absent} color="#ef4444" />
        <StatPill label="Total" value={projected ? projected.projectedTotal : subject.total} />
        <StatPill
          label={projected ? 'Margin (after)' : 'Margin'}
          value={
            projected
              ? projected.projectedCanBunk > 0
                ? `+${projected.projectedCanBunk}`
                : `−${projected.projectedMustAttend}`
              : subject.isBelowThreshold
                ? `−${subject.mustAttend}`
                : `+${subject.canBunk}`
          }
          color={
            projected
              ? projected.dropsBelow75
                ? '#ef4444'
                : '#22c55e'
              : subject.isBelowThreshold
                ? '#ef4444'
                : '#22c55e'
          }
        />
        {projected && (
          <StatPill
            label="After leave"
            value={`${projected.projectedPercentage.toFixed(1)}%`}
            color={projected.dropsBelow75 ? '#ef4444' : '#22c55e'}
          />
        )}
      </div>

      {/* Leave chip when projection active */}
      {projected && (
        <div style={{
          marginTop: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '8px',
          background: projected.dropsBelow75 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${projected.dropsBelow75 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}`,
        }}>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: projected.dropsBelow75 ? '#fca5a5' : '#86efac',
          }}>
            Leave misses {projected.missed} class{projected.missed === 1 ? '' : 'es'}
            {projected.dropsBelow75 ? ' — drops below 75%' : ' — still above 75%'}
          </span>
        </div>
      )}

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {/* Margin Info */}
              {subject.isBelowThreshold ? (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}>
                  <p style={{ fontSize: '0.8rem', color: '#fca5a5', margin: 0, fontWeight: 500 }}>
                    Attend next <span style={{ fontWeight: 700 }}>{subject.mustAttend}</span> consecutive classes to reach 75%
                  </p>
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                }}>
                  <p style={{ fontSize: '0.8rem', color: '#86efac', margin: 0, fontWeight: 500 }}>
                    Can skip <span style={{ fontWeight: 700 }}>{subject.canBunk}</span> more classes and still stay above 75%
                  </p>
                </div>
              )}

              {/* Recovery plan — reach 75% by a concrete date */}
              {subject.isBelowThreshold && reachPlan && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: reachPlan.reachable ? 'rgba(234, 179, 8, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${reachPlan.reachable ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                }}>
                  {!reachPlan.hasSchedule ? (
                    <p style={{ fontSize: '0.78rem', color: W(0.5), margin: 0, fontWeight: 500 }}>
                      No timetable data — can't estimate a date to reach 75%
                    </p>
                  ) : reachPlan.reachable ? (
                    <p style={{ fontSize: '0.78rem', color: '#fde68a', margin: 0, fontWeight: 500 }}>
                      Attend every class till <span style={{ fontWeight: 800, color: '#fbbf24' }}>{displayDate(reachPlan.reachDate!)}</span> to cross 75%
                      <span style={{ color: W(0.45) }}>
                        {' '}— {reachPlan.needed} needed, {reachPlan.futureClasses} on schedule
                      </span>
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.78rem', color: '#fca5a5', margin: 0, fontWeight: 500 }}>
                      Can't reach 75% this semester — only <span style={{ fontWeight: 800 }}>{reachPlan.futureClasses}</span> classes left on schedule
                    </p>
                  )}
                </div>
              )}

              {/* Post-leave recovery — this subject drops below 75% after the planned leave */}
              {projectedReachPlan && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: projectedReachPlan.reachable ? 'rgba(234, 179, 8, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${projectedReachPlan.reachable ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                }}>
                  {projectedReachPlan.reachable && projectedReachPlan.reachDate ? (
                    <p style={{ fontSize: '0.78rem', color: '#fde68a', margin: 0, fontWeight: 500 }}>
                      After leave: attend every class till <span style={{ fontWeight: 800, color: '#fbbf24' }}>{displayDate(projectedReachPlan.reachDate)}</span> to cross 75% again
                      <span style={{ color: W(0.45) }}>
                        {' '}— {projectedReachPlan.needed} needed, {projectedReachPlan.futureClasses} on schedule
                      </span>
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.78rem', color: '#fca5a5', margin: 0, fontWeight: 500 }}>
                      ⚠️ After this leave you can't reach 75% again — only <span style={{ fontWeight: 800 }}>{projectedReachPlan.futureClasses}</span> classes left on schedule
                    </p>
                  )}
                </div>
              )}

              {/* Class schedule by day order */}
              <div>
                <p style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  color: W(0.35),
                  margin: '0 0 6px',
                }}>
                  Class schedule by day order
                </p>
                {doList ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {doList.map(([doName, count]) => (
                      <span key={doName} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.25)',
                      }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--threshold-accent-text)' }}>
                          {doName}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: W(0.55) }}>
                          {count} class{count === 1 ? '' : 'es'}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.72rem', color: W(0.35), margin: 0 }}>
                    No timetable data for this subject
                  </p>
                )}
              </div>

              {/* Category & Slot & Timetable details */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                  {subject.category || 'Category —'}
                </span>
                <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                  Slot: {subject.slot}
                </span>
                {subject.room && subject.room !== 'N/A' && (
                  <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                    Room: {subject.room}
                  </span>
                )}
                {subject.credit && subject.credit !== 'N/A' && (
                  <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                    Credits: {subject.credit}
                  </span>
                )}
                {subject.courseType && subject.courseType !== 'N/A' && (
                  <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                    Type: {subject.courseType}
                  </span>
                )}
                {subject.courseCategory && (
                  <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                    {subject.courseCategory}
                  </span>
                )}
                {subject.facultyId && subject.facultyId !== 'N/A' && (
                  <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                    Faculty ID: {subject.facultyId}
                  </span>
                )}
                {subject.academicYear && (
                  <span style={{ fontSize: '0.7rem', color: W(0.3), padding: '4px 8px', borderRadius: '6px', background: WB(0.04) }}>
                    {subject.academicYear}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
