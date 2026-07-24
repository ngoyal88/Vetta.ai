import { useMemo } from 'react';

import { useVaultEntriesQuery, useVaultVersionQuery } from 'features/vault/queries/useVaultEntriesQuery';
import type { ResumeProfile, VaultEntry, VaultVersion } from 'features/vault/types';

export type ActiveVaultResumeState = {
  profile: ResumeProfile | null;
  entry: VaultEntry | null;
  version: VaultVersion | null;
  loading: boolean;
  reload: () => Promise<void>;
};

export function useActiveVaultResume(): ActiveVaultResumeState {
  const { entries, meta, loading: entriesLoading, refresh: refreshEntries } = useVaultEntriesQuery();

  const activeEntry = useMemo(() => {
    if (!entries.length) return null;
    const activeId = meta.active_resume_id;
    return (
      entries.find((item) => item.id === activeId && item.current_version_id) ??
      entries.find((item) => item.is_active && item.current_version_id) ??
      entries.find((item) => item.current_version_id) ??
      null
    );
  }, [entries, meta.active_resume_id]);

  const versionId = activeEntry?.current_version_id ?? undefined;
  const {
    version,
    loading: versionLoading,
    refresh: refreshVersion,
  } = useVaultVersionQuery(versionId);

  const profile = version?.profile_snapshot ?? null;

  const reload = async () => {
    await Promise.all([refreshEntries(), refreshVersion()]);
  };

  return {
    profile,
    entry: activeEntry,
    version: version ?? null,
    loading: entriesLoading || (Boolean(versionId) && versionLoading),
    reload,
  };
}
