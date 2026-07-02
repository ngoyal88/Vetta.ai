import { useEffect, useState } from 'react';

import { applicationFitApi } from '../services/applicationFitApi';
import type { HistoryEntry } from '../types/applicationFitTypes';

export function useApplicationFitHistory(targetRole: string, jobDescription: string) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const role = targetRole.trim();
    if (!role) {
      setHistory([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void applicationFitApi
      .getHistory(role, jobDescription)
      .then((data) => {
        if (!cancelled) setHistory(data.history ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history');
          setHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetRole, jobDescription]);

  return { history, loading, error };
}
