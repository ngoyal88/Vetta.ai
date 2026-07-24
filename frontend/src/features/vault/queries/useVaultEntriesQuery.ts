import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useAuthQueryEnabled } from 'shared/query/authQuery';
import { queryKeys } from 'shared/query/queryKeys';
import { queryPolicies } from 'shared/query/queryPolicies';
import { queryLoadState } from 'shared/query/queryStatus';

import { vaultApi } from '../services/vaultApi';
import type { VaultListResponse, VaultMeta } from '../types';
import { mergeVaultEntryLists } from '../utils/scorePresentation';

const DEFAULT_META: VaultMeta = { resume_count: 0, active_resume_id: null };

export async function fetchVaultEntries(queryClient: QueryClient): Promise<VaultListResponse> {
  const incoming = await vaultApi.listEntries();
  const cached = queryClient.getQueryData<VaultListResponse>(queryKeys.vault.entries());
  if (cached?.entries?.length) {
    return {
      ...incoming,
      entries: mergeVaultEntryLists(cached.entries, incoming.entries ?? []),
      meta: incoming.meta ?? cached.meta ?? DEFAULT_META,
    };
  }
  return {
    ...incoming,
    entries: incoming.entries ?? [],
    meta: incoming.meta ?? DEFAULT_META,
  };
}

export function useVaultEntriesQuery() {
  const queryClient = useQueryClient();
  const enabled = useAuthQueryEnabled();

  const query = useQuery({
    queryKey: queryKeys.vault.entries(),
    queryFn: () => fetchVaultEntries(queryClient),
    enabled,
    ...queryPolicies.list,
  });

  const data = query.data;
  const entries = data?.entries ?? [];
  const meta = data?.meta ?? DEFAULT_META;
  const loadState = queryLoadState(query.isLoading, query.isFetching, Boolean(data));

  return {
    entries,
    meta,
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : '',
    refresh: query.refetch,
    query,
  };
}

export function useVaultVersionsQuery(resumeId: string | undefined) {
  const enabled = useAuthQueryEnabled() && Boolean(resumeId);

  const query = useQuery({
    queryKey: queryKeys.vault.versions(resumeId ?? ''),
    queryFn: async () => {
      const res = await vaultApi.listVersions(resumeId!);
      return res.versions ?? [];
    },
    enabled,
    ...queryPolicies.list,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    versions: query.data ?? [],
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : '',
    refresh: query.refetch,
    query,
  };
}

export function useVaultVersionQuery(versionId: string | undefined) {
  const enabled = useAuthQueryEnabled() && Boolean(versionId);

  const query = useQuery({
    queryKey: queryKeys.vault.version(versionId ?? ''),
    queryFn: () => vaultApi.getVersion(versionId!),
    enabled,
    ...queryPolicies.detail,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    version: query.data ?? null,
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : '',
    refresh: query.refetch,
    query,
  };
}
