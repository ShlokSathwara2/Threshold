import type { Mark } from './api';
import {
  GRADE_TABLE,
  gradeForTotal,
  schemeFromTotal,
  EXAM_CONVERTED_MAX,
  FULL_INTERNAL_THRESHOLD,
} from './grade-calculator';

// Campus-Web-style forecast model:
//   • a mixed course is scored on 60 internal + 40 end-semester marks,
//   • published internal marks are scaled to the 60-mark internal component,
//   • the end-semester exam is assumed full (40/40) for the forecast,
//   • an internal-only course is scored on its own 0–100 total.
// Every scenario is kept on the same 0–100 scale so the SRM KTR grade bands
// (O 91-100 … F 0-49) apply directly.

export interface GradeStanding {
  grade: string;
  gp: number;
}

export interface Forecast {
  scheme: 'mixed' | 'full';
  /** internal marks still assessable (mixed only) */
  internalRemaining: number;
  /** 0–100 projected total: current pace + assumed full externals */
  projected: number;
  /** 0–100 best case: ace everything still on the table */
  best: number;
  /** 0–100 worst case: only the marks already secured, no externals */
  worst: number;
}

// Core forecast maths. `publishedScored` / `publishedTotal` are the raw marks
// published so far for this subject's internal component.
export function forecastTotals(publishedScored: number, publishedTotal: number): Forecast {
  const scheme = schemeFromTotal(publishedTotal);

  if (scheme === 'full') {
    // Internal-only course: its own total is the final 0–100 mark.
    const pct = publishedTotal > 0 ? (publishedScored / publishedTotal) * 100 : 0;
    return { scheme, internalRemaining: 0, projected: pct, best: pct, worst: pct };
  }

  const internalRemaining = Math.max(0, FULL_INTERNAL_THRESHOLD - publishedTotal);
  const pace = publishedTotal > 0 ? (publishedScored / publishedTotal) * FULL_INTERNAL_THRESHOLD : 0;
  return {
    scheme,
    internalRemaining,
    projected: pace + EXAM_CONVERTED_MAX, // current pace + full externals
    best: Math.min(FULL_INTERNAL_THRESHOLD, publishedScored + internalRemaining) + EXAM_CONVERTED_MAX,
    worst: publishedScored, // only what is already secured, no externals
  };
}

export interface SubjectProjection extends Forecast {
  code: string;
  name: string;
  credits: number;
  /** published marks earned so far (raw) */
  scored: number;
  /** published marks available so far (raw) */
  total: number;
  /** published percentage for this subject */
  pct: number | null;
  /** internal marks already secured */
  internalSecured: number;
  assessments: number;
  awaiting: number;
  projectedGrade: GradeStanding;
  bestGrade: GradeStanding;
  worstGrade: GradeStanding;
  /** remaining internal marks still needed to reach `bestGrade` (mixed only) */
  marksToBest: number;
}

export interface SgpaProjection {
  subjects: SubjectProjection[];
  totalCredits: number;
  publishedPct: number | null;
  publishedScored: number;
  publishedTotal: number;
  assessments: number;
  awaiting: number;
  sgpa: { projected: number | null; best: number | null; worst: number | null };
}

function num(v: string | undefined | null): number {
  const n = parseFloat(v ?? '');
  return isNaN(n) ? 0 : n;
}

function minFor(grade: string): number {
  const row = GRADE_TABLE.find((r) => r.grade === grade);
  return row ? row.min : 0;
}

export function projectSubject(m: Mark, credits: number): SubjectProjection | null {
  const scored = num(m.overall?.scored);
  const total = num(m.overall?.total);
  if (total <= 0 && scored <= 0) return null;

  const f = forecastTotals(scored, total);
  const pct = total > 0 ? (scored / total) * 100 : null;

  let assessments = 0;
  let awaiting = 0;
  for (const t of m.testPerformance ?? []) {
    assessments += 1;
    if (num(t.marks?.total) <= 0) awaiting += 1;
  }

  const projectedGrade = gradeForTotal(f.projected);
  const bestGrade = gradeForTotal(f.best);
  const worstGrade = gradeForTotal(f.worst);
  const marksToBest =
    f.scheme === 'mixed'
      ? Math.max(0, minFor(bestGrade.grade) - EXAM_CONVERTED_MAX - scored)
      : 0;

  return {
    ...f,
    code: m.courseCode,
    name: m.courseName,
    credits,
    scored,
    total,
    pct,
    internalSecured: scored,
    assessments,
    awaiting,
    projectedGrade,
    bestGrade,
    worstGrade,
    marksToBest,
  };
}

// Credit-weighted SGPA — Σ(grade points × credits) ÷ Σ credits.
function weightedSgpa(
  subjects: SubjectProjection[],
  pick: (s: SubjectProjection) => GradeStanding
): number | null {
  let credits = 0;
  let points = 0;
  for (const s of subjects) {
    const c = s.credits > 0 ? s.credits : 0;
    credits += c;
    points += c * pick(s).gp;
  }
  return credits > 0 ? points / credits : null;
}

export function projectSgpa(marks: Mark[], creditFor: (code: string) => number): SgpaProjection {
  const subjects: SubjectProjection[] = [];
  let publishedScored = 0;
  let publishedTotal = 0;
  let assessments = 0;
  let awaiting = 0;

  for (const m of marks) {
    const p = projectSubject(m, creditFor(m.courseCode) || 0);
    if (!p) continue;
    subjects.push(p);
    publishedScored += p.scored;
    publishedTotal += p.total;
    assessments += p.assessments;
    awaiting += p.awaiting;
  }

  return {
    subjects,
    totalCredits: subjects.reduce((acc, s) => acc + (s.credits || 0), 0),
    publishedPct: publishedTotal > 0 ? (publishedScored / publishedTotal) * 100 : null,
    publishedScored,
    publishedTotal,
    assessments,
    awaiting,
    sgpa: {
      projected: weightedSgpa(subjects, (s) => s.projectedGrade),
      best: weightedSgpa(subjects, (s) => s.bestGrade),
      worst: weightedSgpa(subjects, (s) => s.worstGrade),
    },
  };
}
