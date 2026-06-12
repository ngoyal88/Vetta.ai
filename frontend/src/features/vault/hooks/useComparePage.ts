import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { vaultApi } from 'features/vault/services/vaultApi';
import type { CompareResultState, VersionSelection } from 'features/vault/types/compare';
import { getErrorMessage } from 'features/vault/utils/vaultUtils';

import { useVaultLibraryContext } from '../context/VaultLibraryContext';

function countComparableVersions(entries: ReturnType<typeof useVaultLibraryContext>['entries']) {
  const totalVersions = entries.reduce((sum, entry) => sum + (entry.version_count || 0), 0);
  return { totalVersions, canCompare: totalVersions >= 2 || entries.length >= 2 };
}

export function useComparePage() {
  const navigate = useNavigate();
  const { entries, loading: libraryLoading } = useVaultLibraryContext();
  const [selectionA, setSelectionA] = useState<VersionSelection | null>(null);
  const [selectionB, setSelectionB] = useState<VersionSelection | null>(null);
  const [role, setRole] = useState('');
  const [comparing, setComparing] = useState(false);

  const { canCompare } = useMemo(() => countComparableVersions(entries), [entries]);

  const canSubmit = Boolean(
    selectionA &&
      selectionB &&
      !(selectionA.resumeId === selectionB.resumeId && selectionA.versionId === selectionB.versionId),
  );

  const handleCompare = useCallback(async () => {
    if (!selectionA || !selectionB) {
      toast.error('Select two versions');
      return;
    }
    if (selectionA.resumeId === selectionB.resumeId && selectionA.versionId === selectionB.versionId) {
      toast.error('Select two different versions');
      return;
    }

    try {
      setComparing(true);
      const result = await vaultApi.compare(
        selectionA.resumeId,
        selectionB.resumeId,
        role.trim() || undefined,
        selectionA.versionId,
        selectionB.versionId,
      );
      const state: CompareResultState = {
        result,
        selectionA,
        selectionB,
        role: role.trim() || undefined,
      };
      navigate('/resume-vault/compare/result', { state });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Comparison failed'));
    } finally {
      setComparing(false);
    }
  }, [navigate, role, selectionA, selectionB]);

  return {
    entries,
    libraryLoading,
    selectionA,
    selectionB,
    role,
    comparing,
    canCompare,
    canSubmit,
    setSelectionA,
    setSelectionB,
    setRole,
    handleCompare,
  };
}
