import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type InterviewHistoryItem } from 'shared/services/api';
import { useAuthQueryEnabled } from 'shared/query/authQuery';
import { invalidateInterviewHistory } from 'shared/query/invalidateCaches';
import { queryKeys } from 'shared/query/queryKeys';
import { queryPolicies } from 'shared/query/queryPolicies';
import { queryLoadState } from 'shared/query/queryStatus';

import { normalizeHistoryResponse } from '../utils/interviewHistoryUtils';

type UseInterviewHistoryOptions = {
  limit?: number;
  autoFetch?: boolean;
};

export function useInterviewHistory(options: UseInterviewHistoryOptions = {}) {
  const { limit = 20, autoFetch = true } = options;
  const queryClient = useQueryClient();
  const enabled = useAuthQueryEnabled() && autoFetch;

  const query = useQuery({
    queryKey: queryKeys.interview.history(limit),
    queryFn: async () => {
      const data = await api.getInterviewHistory(limit);
      return normalizeHistoryResponse(data);
    },
    enabled,
    ...queryPolicies.list,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);
  const items = query.data ?? [];

  const refresh = useCallback(async () => {
    const result = await query.refetch();
    if (result.error) {
      toast.error('Failed to load interview history');
    }
    return result;
  }, [query]);

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => api.deleteInterview(sessionId),
    onSuccess: async (_data, sessionId) => {
      toast.success('Interview deleted');
      if (expandedId === sessionId) setExpandedId(null);
      await invalidateInterviewHistory(queryClient);
    },
    onError: () => {
      toast.error('Failed to delete interview');
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const deleteInterview = useCallback(
    async (sessionId: string) => {
      if (!window.confirm('Delete this interview? This cannot be undone.')) return;
      setDeletingId(sessionId);
      await deleteMutation.mutateAsync(sessionId);
    },
    [deleteMutation],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return {
    items,
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error ? 'Failed to load interview history' : null,
    refresh,
    deleteInterview,
    expandedId,
    setExpandedId,
    toggleExpanded,
    deletingId,
  };
}

export type { InterviewHistoryItem };
