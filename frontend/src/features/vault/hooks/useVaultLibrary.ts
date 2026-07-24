import { useVaultMutations } from '../mutations/useVaultMutations';
import { useVaultEntriesQuery } from '../queries/useVaultEntriesQuery';

export const useVaultLibrary = () => {
  const { entries, meta, loading, isFetching, error, refresh } = useVaultEntriesQuery();
  const mutations = useVaultMutations();

  return {
    entries,
    meta,
    loading,
    isFetching,
    error,
    refresh,
    ...mutations,
  };
};
