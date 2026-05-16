import { useCallback, useEffect, useState } from 'react';

import { vaultApi } from '../services/vaultApi';
import type { VaultVersion } from '../types';
import { getErrorMessage } from '../utils/vaultUtils';

export function useVaultVersions(resumeId: string | undefined) {
  const [versions, setVersions] = useState<VaultVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!resumeId) {
      setVersions([]);
      setError('');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await vaultApi.listVersions(resumeId);
      setVersions(res.versions || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load versions'));
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { versions, loading, error, refresh };
}
