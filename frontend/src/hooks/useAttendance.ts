"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchSpAttendance,
  fetchAcademiaAttendance,
  fetchCourses,
  fetchUser,
  fetchTimetable,
  isCampusWebSession,
  isAcademiaLoggedIn,
  fetchCampusWebUser,
  fetchCampusWebStudentPortalAttendance,
  adaptCampusWebAttendance,
  type Attendance,
  type AttendanceResponse,
  type Course,
} from '@/lib/api';
import { calculateAllSubjects, calculateOverallStats, type SubjectAttendance, type OverallStats } from '@/lib/attendance-calculator';
import { getCached, setCached } from '@/lib/cache';

const CACHE_NS = 'attendance';

interface AttendanceCache {
  raw: Attendance[];
  subjects: SubjectAttendance[];
  overall: OverallStats;
}

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
  stale: boolean;
  refetch: () => void;
}

export function useAttendance(): UseAttendanceResult {
  // Paint cached data immediately so the dashboard renders instantly;
  // fresh data replaces it when the network call resolves.
  const cached = typeof window === 'undefined' ? null : getCached<AttendanceCache>(CACHE_NS);
  const [raw, setRaw] = useState<Attendance[]>(cached?.data.raw ?? []);
  const [subjects, setSubjects] = useState<SubjectAttendance[]>(cached?.data.subjects ?? []);
  const [overall, setOverall] = useState<OverallStats>(
    cached?.data.overall ?? {
      totalPresent: 0,
      totalAbsent: 0,
      totalClasses: 0,
      overallPercentage: 0,
      subjectsBelowThreshold: 0,
      subjectsSafe: 0,
    }
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [source, setSource] = useState('academia');
  const hasDataRef = useRef((cached?.data.raw.length ?? 0) > 0);

  const load = useCallback(async () => {
    if (!hasDataRef.current) setLoading(true);
    setError(null);
    try {
      let res: AttendanceResponse;

      if (isCampusWebSession()) {
        const session = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('threshold_session') || '{}') : null;
        const netId = session?.user || '';
        console.log('[useAttendance] campus web path, netId:', netId);
        try {
          const spAtt = await fetchCampusWebStudentPortalAttendance(netId);
          console.log('[useAttendance] spAtt result:', spAtt.attendance?.length, 'items');
          if (spAtt.attendance && spAtt.attendance.length > 0) {
            res = spAtt;
          } else {
            console.log('[useAttendance] spAtt empty, falling back to fetchCampusWebUser');
            const user = await fetchCampusWebUser();
            res = adaptCampusWebAttendance(user);
            console.log('[useAttendance] fallback result:', res.attendance?.length, 'items');
          }
        } catch (e) {
          console.warn('[useAttendance] spAtt failed, falling back:', e);
          const user = await fetchCampusWebUser();
          res = adaptCampusWebAttendance(user);
          console.log('[useAttendance] fallback result:', res.attendance?.length, 'items');
        }
      } else {
        const attRes = await fetchSpAttendance();
        res = attRes;
      }

      if (res.error) {
        setError(res.error);
        return;
      }

      const data = res.attendance || [];
      setRaw(data);
      let calculated = calculateAllSubjects(data);

      // Enrich with academia course data (category, credits, slot, room, type),
      // preferring the student's own batch for batch-split lab slots.
      // Only when academia cookies are available.
      console.log('[useAttendance] isAcademiaLoggedIn:', isAcademiaLoggedIn(), 'isCampusWeb:', isCampusWebSession());
      if (isAcademiaLoggedIn()) {
        const [courseRes, userRes] = await Promise.allSettled([
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

        if (courseRes.status === 'fulfilled') {
          const batchText = userRes.status === 'fulfilled' ? userRes.value.batch ?? '' : '';
          const batch = /^\d+$/.test(batchText) ? parseInt(batchText, 10) : null;
          const byCode = pickCourseForBatch(courseRes.value.courses || [], batch);
          console.log('[useAttendance] courses enriched:', byCode.size, 'courses matched');
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
        } else {
          console.warn('[useAttendance] fetchCourses failed:', courseRes.reason, '— trying timetable fallback');
          // fetchCourses failed — fall back to timetable for slot/faculty/room
          try {
            const ttRes = await Promise.race([
              fetchTimetable(),
              new Promise<never>((_, reject) =>
                window.setTimeout(() => reject(new Error('timeout')), 4000)
              ),
            ]);
            if (ttRes.schedule?.length) {
              const ttByCode = new Map<string, { slot: string; faculty: string; room: string }>();
              for (const t of ttRes.schedule) {
                if (!ttByCode.has(t.courseCode)) {
                  ttByCode.set(t.courseCode, { slot: t.slot, faculty: t.faculty, room: t.room });
                }
              }
              calculated = calculated.map((s) => {
                const t = ttByCode.get(s.courseCode);
                if (!t) return s;
                return {
                  ...s,
                  slot: s.slot || t.slot,
                  facultyName: s.facultyName || t.faculty,
                  room: s.room || t.room,
                };
              });
            }
          } catch {
            // timetable also failed — subjects remain with whatever they had
          }
        }
      }

      hasDataRef.current = calculated.length > 0;
      setStale(false);
      setSubjects(calculated);
      setOverall(calculateOverallStats(calculated));
      setCached<AttendanceCache>(CACHE_NS, {
        raw: data,
        subjects: calculated,
        overall: calculateOverallStats(calculated),
      });
    } catch (e: unknown) {
      // Keep showing the last known data on screen; only surface an error
      // when there is nothing cached to show.
      if (!hasDataRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to fetch attendance');
      } else {
        setStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { subjects, overall, raw, loading, error, source, stale, refetch: load };
}