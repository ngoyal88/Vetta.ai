import { useVaultVersionsQuery } from '../queries/useVaultEntriesQuery';

export function useVaultVersions(resumeId: string | undefined) {
  const { versions, loading, error, refresh } = useVaultVersionsQuery(resumeId);

  return { versions, loading, error, refresh };
}
