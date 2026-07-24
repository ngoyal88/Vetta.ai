import { getQueryClient } from 'shared/query/queryClient';
import { queryKeys } from 'shared/query/queryKeys';
import { queryPolicies } from 'shared/query/queryPolicies';

import { fetchVaultEntries } from 'features/vault/queries/useVaultEntriesQuery';

export async function prefetchVaultEntries(): Promise<void> {
  const client = getQueryClient();
  await client.prefetchQuery({
    queryKey: queryKeys.vault.entries(),
    queryFn: () => fetchVaultEntries(client),
    ...queryPolicies.list,
  });
}

export async function prefetchInterviewHistory(limit = 20): Promise<void> {
  const [{ api }, { normalizeHistoryResponse }] = await Promise.all([
    import('shared/services/api'),
    import('features/dashboard/utils/interviewHistoryUtils'),
  ]);
  await getQueryClient().prefetchQuery({
    queryKey: queryKeys.interview.history(limit),
    queryFn: async () => normalizeHistoryResponse(await api.getInterviewHistory(limit)),
    ...queryPolicies.list,
  });
}

export function prefetchForNavPath(path: string): void {
  if (path.startsWith('/resume-vault')) {
    void prefetchVaultEntries();
    return;
  }
  if (path.startsWith('/ai-interview/history')) {
    void prefetchInterviewHistory(20);
    return;
  }
  if (path === '/dashboard') {
    void prefetchInterviewHistory(4);
  }
}
