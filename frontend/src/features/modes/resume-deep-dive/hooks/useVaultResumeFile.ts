import { useEffect, useMemo, useState } from 'react';

import { vaultApi } from 'features/vault/services/vaultApi';
import type { VaultVersion } from 'features/vault/types';
import { getErrorMessage } from 'features/vault/utils/vaultUtils';
import { documentFileLabel, isPdfVersion } from '../utils/resumeDeepDiveUtils';

type UseVaultResumeFileOptions = {
  version: VaultVersion | null;
  entryName?: string | null;
  enabled: boolean;
};

export function useVaultResumeFile({ version, entryName, enabled }: UseVaultResumeFileOptions) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filename = documentFileLabel(version, entryName ? { name: entryName } : null);
  const isPdf = isPdfVersion(version, filename);

  const iframeSrc = useMemo(() => {
    if (!blobUrl || !isPdf) return null;
    return `${blobUrl}#zoom=100&toolbar=0&navpanes=0`;
  }, [blobUrl, isPdf]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (!enabled) {
      setBlobUrl(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    const load = async () => {
      setBlobUrl(null);
      setError('');
      if (!version?.has_source_file) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const blob = await vaultApi.fetchVersionFile(version.id);
        if (cancelled) return;
        revoked = URL.createObjectURL(blob);
        setBlobUrl(revoked);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load resume file'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [enabled, version?.has_source_file, version?.id]);

  return { blobUrl, loading, error, filename, isPdf, iframeSrc };
}
