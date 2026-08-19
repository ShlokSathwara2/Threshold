import type { InternalMark, Mark, TestPerformance } from '@/lib/api';

export interface MergedSubjectMark {
  code: string;
  description: string;
  scored: number;
  maxMark: number;
  tests: TestPerformance[];
  academiaLoaded: boolean;
  academiaOnly: boolean;
}

function num(v: string | number | undefined): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(v ?? '');
  return isNaN(n) ? 0 : n;
}

// Combines the Student Portal total (scored/max per subject) with Academia's
// per-test breakdown. The breakdown is fully dynamic: however many tests the
// portal reports (1, 2, 5, 20… any names) they all come through.
export function mergeInternalMarks(sp: InternalMark[], academia: Mark[]): MergedSubjectMark[] {
  const byCode = new Map<string, MergedSubjectMark>();

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
    });
  }

  const academiaByCode = new Map(academia.map((a) => [a.courseCode, a]));
  for (const [code, m] of byCode) {
    const a = academiaByCode.get(code);
    if (a && a.testPerformance && a.testPerformance.length > 0) {
      m.tests = a.testPerformance;
      m.academiaLoaded = true;
    }
  }

  // Subjects that only Academia reports (no SP internal entry yet).
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
    });
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
  if (avg >= 0.9) return 'O';
  if (avg >= 0.85) return 'A+';
  if (avg >= 0.8) return 'A';
  if (avg >= 0.75) return 'B+';
  if (avg >= 0.7) return 'B';
  if (avg >= 0.6) return 'C';
  if (avg >= 0.5) return 'D';
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