import type { Attendance } from './api';

export interface SubjectAttendance {
  courseCode: string;
  courseTitle: string;
  category: string;
  facultyName: string;
  slot: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger' | 'critical';
  canBunk: number;
  mustAttend: number;
  margin: number;
  isBelowThreshold: boolean;
}

export interface OverallStats {
  totalPresent: number;
  totalAbsent: number;
  totalClasses: number;
  overallPercentage: number;
  subjectsBelowThreshold: number;
  subjectsSafe: number;
}

const THRESHOLD = 75;

export function calculateSubjectAttendance(a: Attendance): SubjectAttendance {
  const total = a.hoursConducted;
  const absent = a.hoursAbsent;
  const present = total - absent;
  const percentage = total > 0 ? (present / total) * 100 : 0;

  let canBunk = 0;
  let mustAttend = 0;

  if (percentage >= THRESHOLD) {
    // How many can we skip and still stay >= 75%?
    // (present - x) / (total + x) >= 0.75
    // present - x >= 0.75 * (total + x)
    // present - x >= 0.75*total + 0.75*x
    // present - 0.75*total >= 1.75*x
    // x <= (present - 0.75*total) / 1.75
    canBunk = Math.floor((present - THRESHOLD / 100 * total) / (1 + THRESHOLD / 100));
  } else {
    // How many consecutive classes must be attended to reach 75%?
    // (present + x) / (total + x) >= 0.75
    // present + x >= 0.75*total + 0.75*x
    // 0.25*x >= 0.75*total - present
    // x >= (0.75*total - present) / 0.25
    mustAttend = Math.ceil((THRESHOLD / 100 * total - present) / (1 - THRESHOLD / 100));
  }

  const margin = percentage - THRESHOLD;

  let status: SubjectAttendance['status'];
  if (percentage >= 85) status = 'safe';
  else if (percentage >= 75) status = 'warning';
  else if (percentage >= 60) status = 'danger';
  else status = 'critical';

  return {
    courseCode: a.courseCode,
    courseTitle: a.courseTitle,
    category: a.category,
    facultyName: a.facultyName,
    slot: a.slot,
    present,
    absent,
    total,
    percentage,
    status,
    canBunk,
    mustAttend,
    margin,
    isBelowThreshold: percentage < THRESHOLD,
  };
}

export function calculateAllSubjects(attendance: Attendance[]): SubjectAttendance[] {
  return attendance
    .map(calculateSubjectAttendance)
    .sort((a, b) => a.margin - b.margin); // danger zone first (lowest margin first)
}

export function calculateOverallStats(subjects: SubjectAttendance[]): OverallStats {
  const totalPresent = subjects.reduce((s, sub) => s + sub.present, 0);
  const totalAbsent = subjects.reduce((s, sub) => s + sub.absent, 0);
  const totalClasses = totalPresent + totalAbsent;
  const overallPercentage = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 0;

  return {
    totalPresent,
    totalAbsent,
    totalClasses,
    overallPercentage,
    subjectsBelowThreshold: subjects.filter(s => s.isBelowThreshold).length,
    subjectsSafe: subjects.filter(s => !s.isBelowThreshold).length,
  };
}
