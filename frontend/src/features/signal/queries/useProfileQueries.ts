import { useQuery } from '@tanstack/react-query';

import { api, type ProfileClaim, type ProfileMemorySummaryV1 } from 'shared/services/api';
import { useAuthQueryEnabled } from 'shared/query/authQuery';
import { queryKeys } from 'shared/query/queryKeys';
import { queryPolicies } from 'shared/query/queryPolicies';
import { queryLoadState } from 'shared/query/queryStatus';

import type { SectionFilter } from '../components/ClaimsInbox';

function sectionToApiArg(section: SectionFilter): string | undefined {
  if (section === 'profile') return 'strength';
  if (section === 'gaps') return 'gap';
  return undefined;
}

export type ProfileMemoryState = {
  summary: ProfileMemorySummaryV1;
  timeline: ProfileClaim[];
} | null;

export function useProfileClaimsQuery(sectionFilter: SectionFilter) {
  const enabled = useAuthQueryEnabled();
  const sectionArg = sectionToApiArg(sectionFilter);

  const query = useQuery({
    queryKey: queryKeys.profile.claims(sectionFilter),
    queryFn: async () => {
      const response = await api.getProfileClaims('pending', 100, sectionArg);
      return response.items ?? [];
    },
    enabled,
    ...queryPolicies.list,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    claims: query.data ?? [],
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
    query,
  };
}

export function useProfileMemoryQuery(limit = 120) {
  const enabled = useAuthQueryEnabled();

  const query = useQuery({
    queryKey: queryKeys.profile.memory(limit),
    queryFn: () => api.getProfileMemory(limit) as Promise<ProfileMemoryState>,
    enabled,
    ...queryPolicies.list,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    memory: query.data ?? null,
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: query.refetch,
    query,
  };
}
