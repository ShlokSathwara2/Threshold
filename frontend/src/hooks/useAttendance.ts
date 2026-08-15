"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchSpAttendance, type Attendance, type AttendanceResponse } from '@/lib/api';
import { calculateAllSubjects, calculateOverallStats, type SubjectAttendance, type OverallStats } from '@/lib/attendance-calculator';

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
      const res: AttendanceResponse = await fetchSpAttendance();
      if (res.error) {
        setError(res.error);
        return;
      }
      const data = res.attendance || [];
      setRaw(data);
      const calculated = calculateAllSubjects(data);
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
