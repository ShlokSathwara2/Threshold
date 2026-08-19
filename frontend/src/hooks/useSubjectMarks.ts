"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  fetchMarks,
  fetchAcademiaMarks,
  fetchSpInternalMarks,
  fetchAttendance,
  fetchSpProfile,
  isAcademiaLoggedIn,
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
      const academiaOn = isAcademiaLoggedIn();
      const [marksRes, internalRes, attRes, profileRes, acaRes] = await Promise.allSettled([
        fetchMarks(),
        fetchSpInternalMarks(),
        fetchAttendance(),
        fetchSpProfile(),
        academiaOn ? fetchAcademiaMarks() : Promise.resolve<MarksResponse>({ regNumber: '', marks: [], status: 200 }),
      ]);

      if (profileRes.status === 'fulfilled' && typeof profileRes.value.profile?.semester === 'number') {
        setSemester(profileRes.value.profile.semester);
      }

      const rawMarks = marksRes.status === 'fulfilled' ? marksRes.value.marks || [] : [];
      const internals = internalRes.status === 'fulfilled' ? internalRes.value.internal_marks || [] : [];
      const attendance = attRes.status === 'fulfilled' ? attRes.value.attendance || [] : [];
      const academiaMarks = acaRes.status === 'fulfilled' ? acaRes.value.marks || [] : [];

      if (marksRes.status === 'rejected' && internalRes.status === 'rejected' && academiaMarks.length === 0) {
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

      // Merge Academia's per-test breakdown into the same subject entries.
      // Any number of components, any names — all carried through.
      for (const m of academiaMarks) {
        if (!m.courseCode || !m.testPerformance || m.testPerformance.length === 0) continue;
        if (currentCodes.size > 0 && !currentCodes.has(m.courseCode)) continue;
        const existing = byCode.get(m.courseCode);
        if (existing) {
          existing.testPerformance = m.testPerformance;
        } else {
          const scored = m.testPerformance.reduce((acc, t) => acc + (parseFloat(t.marks.scored) || 0), 0);
          const total = m.testPerformance.reduce((acc, t) => acc + (parseFloat(t.marks.total) || 0), 0);
          byCode.set(m.courseCode, {
            courseCode: m.courseCode,
            courseName: m.courseName,
            courseType: m.courseType,
            overall: { scored: String(scored), total: String(total) },
            testPerformance: m.testPerformance,
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