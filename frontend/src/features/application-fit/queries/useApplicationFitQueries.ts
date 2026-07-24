import { useQuery } from '@tanstack/react-query';

import { useAuthQueryEnabled } from 'shared/query/authQuery';
import { queryKeys } from 'shared/query/queryKeys';
import { queryPolicies } from 'shared/query/queryPolicies';
import { queryLoadState } from 'shared/query/queryStatus';

import { applicationFitApi } from '../services/applicationFitApi';
import type { HistoryEntry } from '../types/applicationFitTypes';

export function useApplicationFitHistoryQuery(targetRole: string, jobDescription: string) {
  const role = targetRole.trim();
  const enabled = useAuthQueryEnabled() && Boolean(role);

  const query = useQuery({
    queryKey: queryKeys.applicationFit.history(role, jobDescription),
    queryFn: async () => {
      const data = await applicationFitApi.getHistory(role, jobDescription);
      return data.history ?? [];
    },
    enabled,
    ...queryPolicies.list,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    history: (query.data ?? []) as HistoryEntry[],
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error instanceof Error ? query.error.message : null,
    query,
  };
}

export function useApplicationFitSnapshotQuery(snapshotId: string | null) {
  const enabled = useAuthQueryEnabled() && Boolean(snapshotId);

  const query = useQuery({
    queryKey: queryKeys.applicationFit.snapshot(snapshotId ?? ''),
    queryFn: () => applicationFitApi.getSnapshot(snapshotId!),
    enabled,
    ...queryPolicies.detail,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    snapshot: query.data ?? null,
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error,
    query,
  };
}
