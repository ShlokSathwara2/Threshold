"use client";

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import type { TimetableSlot, InternalMark } from '@/lib/api';
import type { SubjectAttendance } from '@/lib/attendance-calculator';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

interface Props {
  subjects: SubjectAttendance[];
  marks: InternalMark[];
  schedule: TimetableSlot[];
}

interface Result {
  code: string;
  title: string;
  subject?: SubjectAttendance;
  mark?: InternalMark;
  slots: { day: string; hour: number; time: string }[];
}

export default function UniversalSearch({ subjects, marks, schedule }: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const byCode = new Map<string, Result>();
    const add = (code: string, title: string) => {
      if (!byCode.has(code)) byCode.set(code, { code, title, slots: [] });
    };
    for (const s of subjects) {
      if (s.courseCode.toLowerCase().includes(q) || s.courseTitle.toLowerCase().includes(q)) {
        add(s.courseCode, s.courseTitle);
        byCode.get(s.courseCode)!.subject = s;
      }
    }
    for (const m of marks) {
      if (m.code.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)) {
        add(m.code, m.description);
        byCode.get(m.code)!.mark = m;
      }
    }
    for (const t of schedule) {
      if (!t.courseCode) continue;
      if (t.courseCode.toLowerCase().includes(q) || (t.courseTitle || '').toLowerCase().includes(q)) {
        add(t.courseCode, t.courseTitle || t.courseCode);
        byCode.get(t.courseCode)!.slots.push({ day: t.day, hour: t.hour, time: t.time || '' });
      }
    }
    return [...byCode.values()].slice(0, 8);
  }, [query, subjects, marks, schedule]);

  const goAttendance = (code: string) => {
    setFocused(false);
    setQuery('');
    router.push(`/dashboard/attendance?code=${encodeURIComponent(code)}`);
  };
  const goMarks = (code: string) => {
    setFocused(false);
    setQuery('');
    router.push(`/dashboard/marks?code=${encodeURIComponent(code)}`);
  };
  const goTimetable = () => {
    setFocused(false);
    setQuery('');
    router.push('/dashboard/timetable');
  };

  const open = focused && query.trim().length >= 2;

  return (
    <div style={{ position: 'relative', zIndex: 5, marginBottom: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        borderRadius: '16px',
        background: 'var(--threshold-surface)',
        border: `1px solid ${focused ? 'rgba(var(--threshold-accent-rgb),0.5)' : WB(0.1)}`,
        transition: 'border-color 0.2s',
      }}>
        <span style={{ color: W(0.4), fontSize: '0.95rem', flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search subjects, codes, marks…"
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--threshold-text)',
            fontSize: '0.9rem',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            style={{
              background: 'none',
              border: 'none',
              color: W(0.35),
              fontSize: '0.85rem',
              cursor: 'pointer',
              padding: '2px',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 'calc(100% + 6px)',
              borderRadius: '16px',
              background: theme.bg,
              border: `1px solid ${WB(0.14)}`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              maxHeight: '60dvh',
              overflowY: 'auto',
            }}
          >
            {results.length === 0 ? (
              <p style={{ margin: 0, padding: '16px', fontSize: '0.75rem', color: W(0.4), textAlign: 'center' }}>
                No matches for &ldquo;{query}&rdquo;
              </p>
            ) : (
              results.map((r) => (
                <div key={r.code} style={{
                  padding: '12px 14px',
                  borderBottom: `1px solid ${WB(0.04)}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      color: 'var(--threshold-accent-text)',
                    }}>
                      {r.code}
                    </span>
                    <span style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.74rem',
                      color: W(0.55),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {r.title}
                    </span>
                    <span style={{
                      flexShrink: 0,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: r.subject ? (
                        r.subject.isBelowThreshold ? '#f87171' : r.subject.percentage >= 85 ? '#4ade80' : '#fbbf24'
                      ) : W(0.3),
                    }}>
                      {r.subject ? `${r.subject.percentage.toFixed(1)}%` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => goAttendance(r.code)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(139,92,246,0.35)',
                        background: 'rgba(139,92,246,0.12)',
                        color: 'var(--threshold-accent-text)',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Attendance
                      {r.subject ? ` · ${r.subject.present}/${r.subject.total}` : ''}
                    </button>
                    {r.mark && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goMarks(r.code)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(59,130,246,0.35)',
                          background: 'rgba(59,130,246,0.12)',
                          color: '#93c5fd',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Marks · {r.mark.scored}/{r.mark.maxMark}
                      </button>
                    )}
                    {r.slots.length > 0 && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={goTimetable}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(34,197,94,0.35)',
                          background: 'rgba(34,197,94,0.1)',
                          color: '#4ade80',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {r.slots.slice(0, 2).map((s) => `${s.day} H${s.hour}`).join(' · ')}
                        {r.slots.length > 2 ? ` +${r.slots.length - 2}` : ''}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}