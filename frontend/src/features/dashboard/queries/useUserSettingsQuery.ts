import { useQuery } from '@tanstack/react-query';

import { useAuth } from 'shared/context/AuthContext';
import { useAuthQueryEnabled } from 'shared/query/authQuery';
import { queryKeys } from 'shared/query/queryKeys';
import { queryPolicies } from 'shared/query/queryPolicies';
import { queryLoadState } from 'shared/query/queryStatus';

import { fetchUserSettings } from '../services/userSettingsService';
import type { UserSettingsDoc } from '../types/userSettings';

export function useUserSettingsQuery() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const enabled = useAuthQueryEnabled() && Boolean(uid);

  const query = useQuery({
    queryKey: queryKeys.user.settings(uid ?? ''),
    queryFn: () => fetchUserSettings(uid!),
    enabled,
    ...queryPolicies.settings,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    settings: (query.data ?? null) as UserSettingsDoc | null,
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error instanceof Error ? query.error.message : '',
    refresh: query.refetch,
    query,
  };
}
