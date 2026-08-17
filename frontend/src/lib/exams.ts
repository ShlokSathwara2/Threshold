import { getCached, setCached } from './cache';

export interface ExamEntry {
  id: string;
  subjectCode: string;
  subjectTitle: string;
  dates: string[];
  description?: string;
}

const NS = 'exams';

export function loadExams(): ExamEntry[] {
  return getCached<ExamEntry[]>(NS)?.data ?? [];
}

export function saveExams(entries: ExamEntry[]) {
  setCached(NS, entries);
}

export function addExam(entry: Omit<ExamEntry, 'id'>): ExamEntry[] {
  const list = loadExams();
  const next: ExamEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    dates: [...new Set(entry.dates)].sort(),
  };
  saveExams([...list, next]);
  return [...list, next];
}

export function removeExam(id: string): ExamEntry[] {
  const list = loadExams().filter((e) => e.id !== id);
  saveExams(list);
  return list;
}

export function parseDate(ds: string): Date {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(date: Date, today: Date): number {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

// Earliest upcoming (incl. today) date for an exam entry, or null when all
// dates are in the past.
export function nextExamDate(entry: ExamEntry, today: Date): Date | null {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const upcoming = entry.dates
    .map(parseDate)
    .filter((d) => d.getTime() >= t.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}

export function examStatus(date: Date, today: Date): 'past' | 'today' | 'upcoming' {
  const diff = daysUntil(date, today);
  return diff < 0 ? 'past' : diff === 0 ? 'today' : 'upcoming';
}

export function formatExamDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}