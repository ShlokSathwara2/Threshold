"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  fetchSpAttendance,
  fetchCourses,
  fetchUser,
  type Attendance,
  type AttendanceResponse,
  type Course,
} from '@/lib/api';
import { calculateAllSubjects, calculateOverallStats, type SubjectAttendance, type OverallStats } from '@/lib/attendance-calculator';

function matchesBatch(slot: string, batch: number): boolean {
  const m = slot.match(/-(\d+)$/);
  if (!m) return true; // no batch filter on the slot
  return parseInt(m[1], 10) === batch;
}

// Same course can appear once per batch (e.g. lab "L3-1" and "L3-2").
// Pick the entry whose lab slot matches the student's batch.
function pickCourseForBatch(courses: Course[], batch: number | null): Map<string, Course> {
  const byCode = new Map<string, Course>();
  for (const c of courses) {
    const existing = byCode.get(c.code);
    if (!existing) {
      byCode.set(c.code, c);
      continue;
    }
    const existingIsLab = existing.slot?.startsWith('L') ?? false;
    const candidateIsLab = c.slot?.startsWith('L') ?? false;
    if (batch !== null) {
      const existingMatches = matchesBatch(existing.slot || '', batch);
      const candidateMatches = matchesBatch(c.slot || '', batch);
      if (!existingMatches && candidateMatches) {
        byCode.set(c.code, c);
      } else if (existingMatches && candidateMatches && existingIsLab && !candidateIsLab) {
        byCode.set(c.code, c);
      }
    }
  }
  return byCode;
}

export interface UseAttendanceResult {
  subjects: SubjectAttendance[];
  overall: OverallStats;
  raw: Attendance[];
  loading: boolean;
  error: string | null;
  source: string;
  refetch: () => void;
}

export function useAttendance(): UseAttendanceResult {
  const [raw, setRaw] = useState<Attendance[]>([]);
  const [subjects, setSubjects] = useState<SubjectAttendance[]>([]);
  const [overall, setOverall] = useState<OverallStats>({
    totalPresent: 0,
    totalAbsent: 0,
    totalClasses: 0,
    overallPercentage: 0,
    subjectsBelowThreshold: 0,
    subjectsSafe: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState('academia');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [attRes, courseRes, userRes] = await Promise.allSettled([
        fetchSpAttendance(),
        Promise.race([
          fetchCourses(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('timeout')), 4000)
          ),
        ]),
        Promise.race([
          fetchUser(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('timeout')), 4000)
          ),
        ]),
      ]);

      if (attRes.status === 'rejected') {
        throw attRes.reason instanceof Error ? attRes.reason : new Error('Failed to fetch attendance');
      }

      const res: AttendanceResponse = attRes.value;
      if (res.error) {
        setError(res.error);
        return;
      }

      const data = res.attendance || [];
      setRaw(data);
      let calculated = calculateAllSubjects(data);

      // Enrich with academia timetable data (category, credits, slot, room, type),
      // preferring the student's own batch for batch-split lab slots.
      if (courseRes.status === 'fulfilled') {
        const batchText = userRes.status === 'fulfilled' ? userRes.value.batch ?? '' : '';
        const batch = /^\d+$/.test(batchText) ? parseInt(batchText, 10) : null;
        const byCode = pickCourseForBatch(courseRes.value.courses || [], batch);
        calculated = calculated.map((s) => {
          const c = byCode.get(s.courseCode);
          if (!c) return s;
          return {
            ...s,
            category: s.category || c.category || '',
            slot: c.slot || s.slot,
            credit: c.credit,
            room: c.room,
            slotType: c.slotType,
            courseType: c.type,
            courseCategory: c.courseCategory,
            academicYear: c.academicYear,
            facultyName: c.facultyName || s.facultyName,
            facultyId: c.facultyId,
          };
        });
      }

      setSubjects(calculated);
      setOverall(calculateOverallStats(calculated));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { subjects, overall, raw, loading, error, source, refetch: load };
}
