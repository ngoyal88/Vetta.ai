import type { QueryClient } from '@tanstack/react-query';

export async function invalidateInterviewHistory(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'interview' &&
      query.queryKey[1] === 'history',
  });
}

export async function invalidateProfileCaches(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'profile' &&
      (query.queryKey[1] === 'claims' || query.queryKey[1] === 'memory'),
  });
}

export async function invalidateAfterInterview(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateInterviewHistory(queryClient),
    invalidateProfileCaches(queryClient),
  ]);
}
