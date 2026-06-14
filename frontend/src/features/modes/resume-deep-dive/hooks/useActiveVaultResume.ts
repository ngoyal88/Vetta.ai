import { useCallback, useEffect, useState } from 'react';

import type { ResumeProfile, VaultEntry, VaultVersion } from 'features/vault/types';
import { vaultApi } from 'features/vault/services/vaultApi';

export type ActiveVaultResumeState = {
  profile: ResumeProfile | null;
  entry: VaultEntry | null;
  version: VaultVersion | null;
  loading: boolean;
  reload: () => Promise<void>;
};

export function useActiveVaultResume(): ActiveVaultResumeState {
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [entry, setEntry] = useState<VaultEntry | null>(null);
  const [version, setVersion] = useState<VaultVersion | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vaultApi.listEntries();
      const entries = data.entries ?? [];
      const activeId = data.meta?.active_resume_id;
      const activeEntry =
        entries.find((item) => item.id === activeId && item.current_version_id) ??
        entries.find((item) => item.is_active && item.current_version_id) ??
        entries.find((item) => item.current_version_id) ??
        null;

      if (!activeEntry?.current_version_id) {
        setEntry(null);
        setVersion(null);
        setProfile(null);
        return;
      }

      const activeVersion = await vaultApi.getVersion(activeEntry.current_version_id);
      setEntry(activeEntry);
      setVersion(activeVersion);
      setProfile(activeVersion?.profile_snapshot ?? null);
    } catch {
      setEntry(null);
      setVersion(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, entry, version, loading, reload };
}
