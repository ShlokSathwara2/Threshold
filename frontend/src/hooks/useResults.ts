"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchSpGrades, type GradesResponse, type SemesterResult } from '@/lib/api';

export interface UseResultsResult {
  data: GradesResponse | null;
  semesters: SemesterResult[];
  cgpa: number | null;
  creditsRegistered: number | null;
  creditsEarned: number | null;
  creditsRequired: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useResults(): UseResultsResult {
  const [data, setData] = useState<GradesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: GradesResponse = await fetchSpGrades();
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    semesters: data?.semesters || [],
    cgpa: data?.cgpa ?? null,
    creditsRegistered: data?.credits_registered ?? null,
    creditsEarned: data?.credits_earned ?? null,
    creditsRequired: data?.credits_required ?? null,
    loading,
    error,
    refetch: load,
  };
}