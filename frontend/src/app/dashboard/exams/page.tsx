"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { isLoggedIn } from '@/lib/api';
import { useSubjectRegistry } from '@/lib/subject-registry';
import { useTheme, overlay, overlayBg, hexToRgba } from '@/lib/theme';
import {
  loadExams,
  addExam,
  removeExam,
  nextExamDate,
  daysUntil,
  examStatus,
  formatExamDate,
  parseDate,
  syncExamsFromCloud,
  type ExamEntry,
} from '@/lib/exams';

const inputStyle = (theme: ReturnType<typeof useTheme>['theme']): React.CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: '10px',
  background: theme.isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
  border: '1px solid var(--threshold-border)',
  color: 'var(--threshold-text)',
  fontSize: '0.8rem',
  fontWeight: 600,
  outline: 'none',
  colorScheme: theme.isLight ? 'light' : 'dark',
});

export default function ExamsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const { courses } = useSubjectRegistry();

  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [subject, setSubject] = useState('');
  const [dates, setDates] = useState<string[]>(['']);
  const [description, setDescription] = useState('');
  const [subjectFocus, setSubjectFocus] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) router.push('/welcome');
  }, [router]);

  useEffect(() => {
    setExams(loadExams());
  }, []);

  useEffect(() => {
    let mounted = true;
    syncExamsFromCloud().then((cloud) => {
      if (mounted && cloud) setExams(cloud);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const today = new Date();

  const enriched = useMemo(() => exams.map((e) => {
    const next = nextExamDate(e, today);
    return { entry: e, next, days: next ? daysUntil(next, today) : null };
  }), [exams, today]);

  const sorted = enriched.slice().sort((a, b) => {
    if (!a.next && !b.next) return 0;
    if (!a.next) return 1;
    if (!b.next) return -1;
    return a.next.getTime() - b.next.getTime();
  });

  const upcomingCount = enriched.filter((x) => x.next).length;
  const nextUpcoming = sorted.find((x) => x.next) ?? null;

  const knownCodes = new Set(courses.map((c) => c.code.toUpperCase()));

  const subjectMatches = useMemo(() => {
    const q = subject.trim().toLowerCase();
    if (!q) return courses;
    return courses
      .filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
      .slice(0, 12);
  }, [courses, subject]);

  const handleAdd = () => {
    const validDates = dates.map((d) => d.trim()).filter(Boolean);
    const code = subject.trim().toUpperCase();
    if (!code || validDates.length === 0) return;
    const course = courses.find((c) => c.code.toUpperCase() === code);
    const title = course?.title || code;
    setExams(addExam({
      subjectCode: code,
      subjectTitle: title,
      dates: validDates,
      description: description.trim() || undefined,
    }));
    setSubject('');
    setDates(['']);
    setDescription('');
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--threshold-text)', marginBottom: '4px' }}>
          Exams
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Exam dates, countdowns and reminders — synced to your login
        </p>
      </motion.div>

      {/* ── Next exam summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '18px',
          marginBottom: '16px',
          padding: '18px',
          background: nextUpcoming
            ? `linear-gradient(135deg, ${hexToRgba(theme.accent, 0.16)}, ${hexToRgba(theme.accent, 0.04)})`
            : WB(0.02),
          border: `1px solid ${nextUpcoming ? hexToRgba(theme.accent, 0.3) : WB(0.08)}`,
        }}
      >
        <div style={{ position: 'absolute', right: -20, top: -30, width: 140, height: 140, borderRadius: '50%', pointerEvents: 'none', background: `radial-gradient(circle, ${hexToRgba(theme.accent, 0.18)}, transparent 70%)` }} />
        {nextUpcoming ? (
          <div style={{ position: 'relative' }}>
            <p style={{
              margin: 0,
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.7px',
              textTransform: 'uppercase',
              color: 'var(--threshold-accent-text)',
            }}>
              Next exam
            </p>
            <p style={{ margin: '6px 0 2px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--threshold-text)' }}>
              {nextUpcoming.entry.subjectTitle}
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: W(0.5) }}>
              {formatExamDate(nextUpcoming.next!)} ·{' '}
              <span style={{ fontWeight: 800, color: nextUpcoming.days === 0 ? '#f87171' : nextUpcoming.days === 1 ? '#fbbf24' : 'var(--threshold-accent-text)' }}>
                {nextUpcoming.days === 0 ? 'TODAY' : nextUpcoming.days === 1 ? 'TOMORROW' : `in ${nextUpcoming.days} days`}
              </span>
            </p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--threshold-text)' }}>
              {exams.length === 0 ? 'No exams tracked yet' : 'All exams done'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: W(0.5) }}>
              {exams.length === 0
                ? 'Add your exam dates below and get countdowns + dashboard alerts.'
                : 'Add the next round of exam dates below.'}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.62rem',
            fontWeight: 700,
            background: hexToRgba(theme.accent, 0.14),
            border: `1px solid ${hexToRgba(theme.accent, 0.3)}`,
            color: 'var(--threshold-accent-text)',
          }}>
            {upcomingCount} upcoming
          </span>
          <span style={{
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '0.62rem',
            fontWeight: 700,
            background: WB(0.05),
            border: `1px solid ${WB(0.1)}`,
            color: W(0.6),
          }}>
            {exams.length} tracked
          </span>
        </div>
      </motion.div>

      {/* ── Add exam ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        style={{
          borderRadius: '16px',
          background: WB(0.02),
          border: `1px solid ${WB(0.08)}`,
          marginBottom: '16px',
        }}
      >
        <div style={{
          padding: '13px 16px',
          borderBottom: `1px solid ${WB(0.05)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--threshold-text)', margin: 0 }}>
            + Add exam
          </h2>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.5px', color: W(0.4) }}>
            MULTIPLE DATES OK
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 16px 16px' }}>
          {/* Subject */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: W(0.6), marginBottom: '5px' }}>
              SUBJECT
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setSubjectFocus(true)}
              onBlur={() => setTimeout(() => setSubjectFocus(false), 150)}
              placeholder="e.g. CS201 — Data Structures"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ ...inputStyle(theme), width: '100%' }}
            />
            {subjectFocus && courses.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 20,
                borderRadius: '12px',
                background: theme.bg,
                border: `1px solid ${WB(0.14)}`,
                boxShadow: '0 14px 36px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                maxHeight: '264px',
                overflowY: 'auto',
              }}>
                {subjectMatches.length === 0 ? (
                  <p style={{ margin: 0, padding: '13px 14px', fontSize: '0.72rem', color: W(0.45) }}>
                    No matching subject — it will be saved as a custom exam.
                  </p>
                ) : (
                  subjectMatches.map((c) => {
                    const selected = subject.trim().toUpperCase() === c.code.toUpperCase();
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSubject(c.code);
                          setSubjectFocus(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '11px 14px',
                          background: selected ? 'rgba(var(--threshold-accent-rgb),0.12)' : 'none',
                          border: 'none',
                          borderBottom: `1px solid ${WB(0.04)}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{
                          flexShrink: 0,
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          color: 'var(--threshold-accent-text)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(var(--threshold-accent-rgb),0.15)',
                          border: '1px solid rgba(var(--threshold-accent-rgb),0.3)',
                        }}>
                          {c.code}
                        </span>
                        <span style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: '0.74rem',
                          color: W(0.6),
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {c.title}
                        </span>
                        {selected && (
                          <span style={{ flexShrink: 0, color: 'var(--threshold-accent-text)', fontSize: '0.72rem', fontWeight: 800 }}>
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: W(0.6), marginBottom: '5px' }}>
              DATES
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dates.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => setDates((prev) => prev.map((x, xi) => (xi === i ? e.target.value : x)))}
                    style={inputStyle(theme)}
                    aria-label={`Exam date ${i + 1}`}
                  />
                  <button
                    onClick={() => setDates((prev) => prev.filter((_, xi) => xi !== i))}
                    disabled={dates.length === 1}
                    aria-label="Remove date"
                    style={{
                      flexShrink: 0,
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      border: `1px solid ${WB(0.1)}`,
                      background: WB(0.04),
                      color: W(0.5),
                      fontSize: '0.9rem',
                      cursor: dates.length === 1 ? 'not-allowed' : 'pointer',
                      opacity: dates.length === 1 ? 0.4 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setDates((prev) => [...prev, ''])}
              style={{
                marginTop: '8px',
                padding: '7px 14px',
                borderRadius: '9px',
                border: `1px dashed ${hexToRgba(theme.accent, 0.45)}`,
                background: hexToRgba(theme.accent, 0.07),
                color: 'var(--threshold-accent-text)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ＋ Add another date
            </button>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: W(0.6), marginBottom: '5px' }}>
              DESCRIPTION <span style={{ fontWeight: 500, color: W(0.35) }}>(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Internal 1 · Unit 1–3"
              style={inputStyle(theme)}
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={!subject.trim() || dates.every((d) => !d.trim())}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: subject.trim() && dates.some((d) => d.trim()) ? 'var(--threshold-accent)' : WB(0.07),
              color: subject.trim() && dates.some((d) => d.trim()) ? '#fff' : W(0.35),
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: subject.trim() && dates.some((d) => d.trim()) ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Save exam
          </button>
        </div>
      </motion.div>

      {/* ── Tracked exams ── */}
      {sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sorted.map(({ entry, next, days }, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.04 }}
              style={{
                borderRadius: '14px',
                padding: '13px 16px',
                background: WB(0.02),
                border: `1px solid ${next && days === 0 ? hexToRgba(theme.accent, 0.45) : WB(0.08)}`,
                boxShadow: next && days === 0 ? `0 0 20px ${hexToRgba(theme.accent, 0.14)}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--threshold-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.subjectTitle}
                    </p>
                    {next && (
                      <span style={{
                        flexShrink: 0,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        letterSpacing: '0.4px',
                        background: days === 0
                          ? 'rgba(239,68,68,0.15)'
                          : days === 1
                            ? 'rgba(245,158,11,0.15)'
                            : hexToRgba(theme.accent, 0.13),
                        border: `1px solid ${days === 0 ? 'rgba(239,68,68,0.35)' : days === 1 ? 'rgba(245,158,11,0.35)' : hexToRgba(theme.accent, 0.3)}`,
                        color: days === 0 ? '#f87171' : days === 1 ? '#fbbf24' : 'var(--threshold-accent-text)',
                      }}>
                        {days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `IN ${days}d`}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.66rem', color: W(0.4), fontWeight: 600 }}>
                    {entry.subjectCode}
                    {!knownCodes.has(entry.subjectCode) && entry.subjectCode !== entry.subjectTitle.toUpperCase() ? ' · custom' : ''}
                  </p>
                  {entry.description && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: W(0.55) }}>
                      {entry.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {entry.dates.map((ds) => {
                      const status = examStatus(parseDate(ds), today);
                      const passed = status === 'past';
                      return (
                        <span key={ds} style={{
                          padding: '4px 9px',
                          borderRadius: '8px',
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          background: status === 'today'
                            ? hexToRgba(theme.accent, 0.18)
                            : passed ? WB(0.03) : WB(0.05),
                          border: `1px solid ${status === 'today' ? hexToRgba(theme.accent, 0.5) : passed ? WB(0.06) : WB(0.1)}`,
                          color: status === 'today'
                            ? 'var(--threshold-accent-text)'
                            : passed ? W(0.3) : W(0.6),
                          textDecoration: passed ? 'line-through' : 'none',
                        }}>
                          {formatExamDate(parseDate(ds))}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setExams(removeExam(entry.id))}
                  aria-label={`Delete ${entry.subjectTitle}`}
                  style={{
                    flexShrink: 0,
                    width: '30px',
                    height: '30px',
                    borderRadius: '9px',
                    border: `1px solid ${WB(0.08)}`,
                    background: 'transparent',
                    color: W(0.35),
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  🗑
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}