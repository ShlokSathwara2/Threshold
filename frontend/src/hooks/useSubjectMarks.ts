"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  fetchMarks,
  fetchSpInternalMarks,
  fetchAttendance,
  fetchSpProfile,
  type MarksResponse,
  type Mark,
} from '@/lib/api';

export interface UseSubjectMarksResult {
  marks: Mark[];
  loading: boolean;
  error: string | null;
  semester: number | null;
  refetch: () => void;
}

export function useSubjectMarks(): UseSubjectMarksResult {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [semester, setSemester] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [marksRes, internalRes, attRes, profileRes] = await Promise.allSettled([
        fetchMarks(),
        fetchSpInternalMarks(),
        fetchAttendance(),
        fetchSpProfile(),
      ]);

      if (profileRes.status === 'fulfilled' && typeof profileRes.value.profile?.semester === 'number') {
        setSemester(profileRes.value.profile.semester);
      }

      const rawMarks = marksRes.status === 'fulfilled' ? marksRes.value.marks || [] : [];
      const internals = internalRes.status === 'fulfilled' ? internalRes.value.internal_marks || [] : [];
      const attendance = attRes.status === 'fulfilled' ? attRes.value.attendance || [] : [];

      if (marksRes.status === 'rejected' && internalRes.status === 'rejected') {
        throw marksRes.reason instanceof Error ? marksRes.reason : new Error('Failed to fetch marks');
      }

      // Current semester = subjects listed in attendance / internal marks.
      // Attendance is the authoritative current-semester list; internal marks
      // carry the real scored/total numbers for those same subjects.
      const currentCodes = new Set<string>();
      for (const a of attendance) if (a.courseCode) currentCodes.add(a.courseCode);
      for (const i of internals) if (i.code) currentCodes.add(i.code);

      const byCode = new Map<string, Mark>();
      for (const m of rawMarks) {
        if (currentCodes.size > 0 && !currentCodes.has(m.courseCode)) continue;
        byCode.set(m.courseCode, m);
      }
      for (const i of internals) {
        if (!i.code) continue;
        const existing = byCode.get(i.code);
        if (existing) {
          existing.overall = { scored: i.scored, total: i.maxMark };
        } else {
          byCode.set(i.code, {
            courseCode: i.code,
            courseName: i.description,
            courseType: '',
            overall: { scored: i.scored, total: i.maxMark },
            testPerformance: [],
          });
        }
      }

      setMarks([...byCode.values()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch marks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { marks, loading, error, semester, refetch: load };
}