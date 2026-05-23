import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { api } from 'shared/services/api';
import type { InterviewHistoryItem } from 'shared/services/api';
import { normalizeHistoryResponse } from '../utils/interviewHistoryUtils';

type UseInterviewHistoryOptions = {
  limit?: number;
  autoFetch?: boolean;
};

export function useInterviewHistory(options: UseInterviewHistoryOptions = {}) {
  const { limit = 20, autoFetch = true } = options;

  const [items, setItems] = useState<InterviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getInterviewHistory(limit);
      setItems(normalizeHistoryResponse(data));
    } catch {
      setError('Failed to load interview history');
      toast.error('Failed to load interview history');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const deleteInterview = useCallback(
    async (sessionId: string) => {
      if (!window.confirm('Delete this interview? This cannot be undone.')) return;
      try {
        setDeletingId(sessionId);
        await api.deleteInterview(sessionId);
        toast.success('Interview deleted');
        if (expandedId === sessionId) setExpandedId(null);
        await refresh();
      } catch {
        toast.error('Failed to delete interview');
      } finally {
        setDeletingId(null);
      }
    },
    [expandedId, refresh],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (autoFetch) refresh();
  }, [autoFetch, refresh]);

  return {
    items,
    loading,
    error,
    refresh,
    deleteInterview,
    expandedId,
    setExpandedId,
    toggleExpanded,
    deletingId,
  };
}
