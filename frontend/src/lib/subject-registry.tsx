"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { fetchCourses, type Course } from '@/lib/api';

const CACHE_KEY = 'threshold_subject_registry';

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
    const raw = localStorage.getItem(CACHE_KEY);
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
      if (res.error) throw new Error(res.error);
      const list = res.courses || [];
      if (list.length > 0) {
        setCourses(list);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(list));
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