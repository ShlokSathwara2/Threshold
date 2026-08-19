"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { fetchCourses, fetchSpAttendance, type Course } from '@/lib/api';
import { scopedKey, isSingleUserDevice } from '@/lib/user-scope';

// Course registry cache is per-login — each student's subject list stays
// their own, even on a shared phone.
const LEGACY_CACHE_KEY = 'threshold_subject_registry';
const CACHE_KEY = () => scopedKey('threshold_subject_registry');

interface SubjectRegistryValue {
  courses: Course[];
  loading: boolean;
  error: string | null;
  getSubject: (code: string) => Course | undefined;
  refetch: () => void;
}

const SubjectRegistryContext = createContext<SubjectRegistryValue>({
  courses: [],
  loading: true,
  error: null,
  getSubject: () => undefined,
  refetch: () => {},
});

function loadCache(): Course[] | null {
  try {
    let raw = localStorage.getItem(CACHE_KEY());
    if (!raw) {
      if (!isSingleUserDevice()) return null;
      raw = localStorage.getItem(LEGACY_CACHE_KEY);
      if (raw) {
        localStorage.setItem(CACHE_KEY(), raw);
        localStorage.removeItem(LEGACY_CACHE_KEY);
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function SubjectRegistryProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(() => loadCache() || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCourses();
      let list: Course[] = res.courses || [];

      // Academia's /courses endpoint is paused — fall back to the Student
      // Portal attendance list so subject pickers (e.g. add-exam dropdown)
      // always have the student's real enrolled subjects.
      if (list.length === 0 && !res.error) {
        const att = await fetchSpAttendance();
        list = (att.attendance || []).map((a) => ({
          code: a.courseCode,
          title: a.courseTitle,
          credit: '',
          category: a.category || '',
          courseCategory: '',
          type: '',
          slotType: '',
          faculty: a.facultyName || '',
          facultyName: a.facultyName || '',
          facultyId: '',
          slot: a.slot || '',
          room: '',
          academicYear: '',
        }));
      }

      if (list.length > 0) {
        // Academia /courses can return the same code once per part (theory
        // "A" row + practical "P29-P30-" row) — keep one entry per subject.
        const unique = [...new Map(list.map((c) => [c.code, c] as const)).values()];
        setCourses(unique);
        try {
          localStorage.setItem(CACHE_KEY(), JSON.stringify(unique));
        } catch {
          /* ignore */
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load subject registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (courses.length === 0) load();
  }, [courses.length, load]);

  const getSubject = useCallback(
    (code: string) => courses.find((c) => c.code === code),
    [courses]
  );

  return (
    <SubjectRegistryContext.Provider value={{ courses, loading, error, getSubject, refetch: load }}>
      {children}
    </SubjectRegistryContext.Provider>
  );
}

export function useSubjectRegistry() {
  return useContext(SubjectRegistryContext);
}