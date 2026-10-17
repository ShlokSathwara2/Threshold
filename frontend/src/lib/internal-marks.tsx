import type { InternalMark, Mark, TestPerformance } from '@/lib/api';
import { GRADE_TABLE } from '@/lib/grade-calculator';

export type MarksSource = 'sp' | 'academia' | 'campusweb';

export interface MergedSubjectMark {
  code: string;
  description: string;
  scored: number;
  maxMark: number;
  tests: TestPerformance[];
  academiaLoaded: boolean;
  academiaOnly: boolean;
  /** Which source supplied the totals/breakdown shown for this subject. */
  source: MarksSource;
}

function num(v: string | number | undefined): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(v ?? '');
  return isNaN(n) ? 0 : n;
}

// Like num(), but distinguishes "absent" from a genuine 0 — Campus Web totals
// must override SP values only when they are actually present.
function numOrNull(v: string | number | undefined): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

// Combines the Student Portal totals, the Campus Web component-wise breakdown
// (FT-I, FT-II, quizzes… exactly as the Campus Web site shows it) and an
// optional separately-signed-in Academia session. Breakdowns are fully
// dynamic: however many components a source reports, they all come through.
export function mergeInternalMarks(
  sp: InternalMark[],
  academia: Mark[],
  campusWeb: Mark[] = [],
): MergedSubjectMark[] {
  const byCode = new Map<string, MergedSubjectMark>();

  // 1) Student Portal totals — one row per subject.
  for (const m of sp) {
    if (!m.code) continue;
    byCode.set(m.code, {
      code: m.code,
      description: m.description,
      scored: num(m.scored),
      maxMark: num(m.maxMark),
      tests: [],
      academiaLoaded: false,
      academiaOnly: false,
      source: 'sp',
    });
  }

  // 2) Campus Web — authoritative totals + the component-wise breakdown.
  for (const cw of campusWeb) {
    if (!cw.courseCode) continue;
    const scored = numOrNull(cw.overall?.scored);
    const max = numOrNull(cw.overall?.total);
    const tests = cw.testPerformance || [];
    const existing = byCode.get(cw.courseCode);
    if (existing) {
      if (scored !== null) existing.scored = scored;
      if (max !== null) existing.maxMark = max;
      if (tests.length > 0) existing.tests = tests;
      if (!existing.description && cw.courseName) existing.description = cw.courseName;
      existing.source = 'campusweb';
    } else {
      byCode.set(cw.courseCode, {
        code: cw.courseCode,
        description: cw.courseName || '',
        scored: scored ?? 0,
        maxMark: max ?? 0,
        tests,
        academiaLoaded: tests.length > 0,
        academiaOnly: false,
        source: 'campusweb',
      });
    }
  }

  // 3) A separately signed-in Academia session fills in any breakdown the
  //    other sources are still missing.
  const academiaByCode = new Map(academia.map((a) => [a.courseCode, a]));
  for (const [code, m] of byCode) {
    const a = academiaByCode.get(code);
    if (a && a.testPerformance && a.testPerformance.length > 0 && m.tests.length === 0) {
      m.tests = a.testPerformance;
      m.academiaLoaded = true;
      if (m.source === 'sp') m.source = 'academia';
    }
  }

  // 4) Subjects that only Academia reports (no SP/CW entry yet).
  for (const a of academia) {
    if (!a.courseCode || byCode.has(a.courseCode)) continue;
    const tests = a.testPerformance || [];
    if (tests.length === 0) continue;
    const scored = tests.reduce((acc, t) => acc + num(t.marks.scored), 0);
    const maxMark = tests.reduce((acc, t) => acc + num(t.marks.total), 0);
    byCode.set(a.courseCode, {
      code: a.courseCode,
      description: a.courseName,
      scored,
      maxMark,
      tests,
      academiaLoaded: true,
      academiaOnly: true,
      source: 'academia',
    });
  }

  // 5) Some courses (labs, projects, F-courses) carry a component breakdown
  //    but no `overall` total — the portal returns "0 / 0" for them. Derive
  //    the subject total from its components so it never shows "0.0 / 0".
  for (const m of byCode.values()) {
    if (m.maxMark <= 0 && m.tests.length > 0) {
      m.scored = m.tests.reduce((acc, t) => acc + num(t.marks.scored), 0);
      m.maxMark = m.tests.reduce((acc, t) => acc + num(t.marks.total), 0);
    }
  }

  return [...byCode.values()];
}

// Combined score/total across every subject (SP totals when present,
// otherwise summed from the academia test breakdown).
export function combinedTotal(subjects: MergedSubjectMark[]): { scored: number; maxMark: number } {
  return subjects.reduce(
    (acc, s) => ({
      scored: acc.scored + (s.maxMark > 0 ? s.scored : 0),
      maxMark: acc.maxMark + s.maxMark,
    }),
    { scored: 0, maxMark: 0 },
  );
}

export function subjectPct(s: MergedSubjectMark): number | null {
  if (s.maxMark <= 0) return null;
  return (s.scored / s.maxMark) * 100;
}

export function gradeFor(avg: number): string {
  // avg is a fraction (0–1). SRM KTR bands, single source of truth.
  const pct = avg * 100;
  for (const row of GRADE_TABLE) {
    if (pct >= row.min) return row.grade;
  }
  return 'F';
}

// Small SVG ring for a percentage — used for the overall gauge and each
// subject's own gauge.
export function Ring({
  pct,
  size = 72,
  stroke = 6,
  color,
  track,
  children,
}: {
  pct: number | null;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * fill) / 100}
          style={{ transition: 'stroke-dashoffset 0.9s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function pctColor(pct: number | null): string {
  if (pct === null) return '#8b5cf6';
  if (pct >= 80) return '#34d399';
  if (pct >= 60) return '#facc15';
  return '#f87171';
}