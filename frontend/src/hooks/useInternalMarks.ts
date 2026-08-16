"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchSpInternalMarks, type InternalMark } from '@/lib/api';

export interface UseInternalMarksResult {
  marks: InternalMark[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useInternalMarks(): UseInternalMarksResult {
  const [marks, setMarks] = useState<InternalMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpInternalMarks();
      if (res.error) {
        setError(res.error);
        return;
      }
      setMarks(res.internal_marks || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch internal marks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { marks, loading, error, refetch: load };
}