import { useQuery } from '@tanstack/react-query';

import { useAuthQueryEnabled } from 'shared/query/authQuery';
import { queryKeys } from 'shared/query/queryKeys';
import { queryPolicies } from 'shared/query/queryPolicies';
import { queryLoadState } from 'shared/query/queryStatus';

import { resumeBuilderApi } from '../services/resumeBuilderApi';

const BUILDER_ENABLED = import.meta.env.VITE_RESUME_BUILDER_ENABLED === 'true';

export function useBuilderHealthQuery() {
  const enabled = useAuthQueryEnabled() && BUILDER_ENABLED;

  const query = useQuery({
    queryKey: queryKeys.resumeBuilder.health(),
    queryFn: () => resumeBuilderApi.getHealth(),
    enabled,
    ...queryPolicies.catalog,
  });

  return {
    health: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    query,
  };
}

export function useBuilderTemplatesQuery() {
  const enabled = useAuthQueryEnabled() && BUILDER_ENABLED;

  const query = useQuery({
    queryKey: queryKeys.resumeBuilder.templates(),
    queryFn: async () => {
      const response = await resumeBuilderApi.listTemplates();
      return response.templates;
    },
    enabled,
    ...queryPolicies.catalog,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    templates: query.data ?? [],
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error,
    query,
  };
}

export function useBuilderDraftsQuery() {
  const enabled = useAuthQueryEnabled() && BUILDER_ENABLED;

  const query = useQuery({
    queryKey: queryKeys.resumeBuilder.drafts(),
    queryFn: async () => {
      const response = await resumeBuilderApi.listDrafts();
      return response.drafts;
    },
    enabled,
    ...queryPolicies.list,
  });

  const loadState = queryLoadState(query.isLoading, query.isFetching, query.data !== undefined);

  return {
    drafts: query.data ?? [],
    loading: loadState.showSkeleton,
    isFetching: loadState.showRefreshing,
    error: query.error,
    refresh: query.refetch,
    query,
  };
}