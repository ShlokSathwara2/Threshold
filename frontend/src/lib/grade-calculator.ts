export const GRADE_TABLE: { min: number; grade: string; gp: number }[] = [
  { min: 91, grade: 'O', gp: 10 },
  { min: 81, grade: 'A+', gp: 9 },
  { min: 71, grade: 'A', gp: 8 },
  { min: 61, grade: 'B+', gp: 7 },
  { min: 51, grade: 'B', gp: 6 },
  { min: 41, grade: 'C', gp: 5 },
  { min: 0, grade: 'F', gp: 0 },
];

export const GRADE_POINTS: Record<string, number> = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  F: 0,
};

export function gradeForTotal(total: number): { grade: string; gp: number } {
  for (const row of GRADE_TABLE) {
    if (total >= row.min) return { grade: row.grade, gp: row.gp };
  }
  return { grade: 'F', gp: 0 };
}

// Fully-internal scheme when the subject's cumulative total exceeds 60
export const FULL_INTERNAL_THRESHOLD = 60;

export type MarksScheme = 'mixed' | 'full';

export function schemeFromTotal(total: number | null | undefined): MarksScheme {
  if (total === null || total === undefined || isNaN(total)) return 'mixed';
  return total > FULL_INTERNAL_THRESHOLD ? 'full' : 'mixed';
}

export interface GradeBand {
  grade: string;
  gp: number;
  min: number;
  required: number | null; // converted exam marks needed (40-scale); null = already achieved, 0 = achievable at 0, -1 = impossible
  requiredRaw: number | null; // same need in raw 75-scale exam marks
  impossible: boolean;
}

export const EXAM_CONVERTED_MAX = 40;
export const EXAM_RAW_MAX = 75;

// Raw 75-scale exam gets converted to 40: converted = raw * 40/75
export function convertedToRaw(converted: number): number {
  return Math.ceil((converted * EXAM_RAW_MAX) / EXAM_CONVERTED_MAX);
}

// Mixed scheme (60 internal + 40 end-sem): back-calculate required exam marks
export function requiredExamForGrade(internalScored: number, threshold: number): { required: number | null; impossible: boolean } {
  if (internalScored >= threshold) return { required: null, impossible: false };
  const needed = threshold - internalScored;
  if (needed > EXAM_CONVERTED_MAX) return { required: -1, impossible: true };
  return { required: needed, impossible: false };
}

export function gradeBandsForInternal(internalScored: number, internalTotal: number): GradeBand[] {
  const total = internalTotal > 0 ? internalTotal : 60;
  const scheme = schemeFromTotal(total);

  if (scheme === 'full') {
    return GRADE_TABLE.map((row) => ({
      grade: row.grade,
      gp: row.gp,
      min: row.min,
      required: null,
      requiredRaw: null,
      impossible: false,
    }));
  }

  return GRADE_TABLE.map((row) => {
    const { required, impossible } = requiredExamForGrade(internalScored, row.min);
    return {
      grade: row.grade,
      gp: row.gp,
      min: row.min,
      required,
      requiredRaw: required !== null && required !== -1 ? convertedToRaw(required) : null,
      impossible,
    };
  });
}

export interface CgpaRow {
  id: string;
  name: string;
  credits: number;
  grade: string;
  courseCode?: string;
}

export function computeSgpa(rows: CgpaRow[]): { sgpa: number; totalCredits: number; totalPoints: number } {
  let totalCredits = 0;
  let totalPoints = 0;
  for (const row of rows) {
    const credits = Math.max(0, row.credits || 0);
    const gp = GRADE_POINTS[row.grade] ?? 0;
    totalCredits += credits;
    totalPoints += credits * gp;
  }
  return {
    sgpa: totalCredits > 0 ? totalPoints / totalCredits : 0,
    totalCredits,
    totalPoints,
  };
}