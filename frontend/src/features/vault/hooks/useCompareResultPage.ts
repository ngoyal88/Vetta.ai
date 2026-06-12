import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { VAULT_COMPARE_RESULT_COPY } from 'features/vault/constants/compareResultContent';
import type { CompareResultState } from 'features/vault/types/compare';
import {
  buildActualDiffSections,
  buildPaneChanges,
} from 'features/vault/utils/compareDiffPresentation';
import {
  downloadCompareReport,
  getRecommendedVersionNumber,
  getScoreImprovement,
} from 'features/vault/utils/compareResultPresentation';
import { getErrorMessage } from 'features/vault/utils/vaultUtils';

import { useVaultLibraryContext } from '../context/VaultLibraryContext';

export function useCompareResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { restoreVersion } = useVaultLibraryContext();
  const state = location.state as CompareResultState | null;
  const copy = VAULT_COMPARE_RESULT_COPY;

  const [promoting, setPromoting] = useState(false);

  const presentation = useMemo(() => {
    if (!state?.result) return null;

    const { result, selectionA, selectionB, role } = state;
    const versionANumber = result.version_a_number ?? selectionA.version.version_number;
    const versionBNumber = result.version_b_number ?? selectionB.version.version_number;
    const nameA = result.resume_a_name || selectionA.entry.name;
    const nameB = result.resume_b_name || selectionB.entry.name;
    const recommendedVersionNumber = getRecommendedVersionNumber(result, versionANumber, versionBNumber);
    const recommendedSelection = result.recommended_id === 'a' ? selectionA : selectionB;
    const paneChanges = buildPaneChanges(result);
    const canPromote =
      recommendedSelection.versionId !== recommendedSelection.entry.current_version_id;

    return {
      result,
      selectionA,
      selectionB,
      role,
      nameA,
      nameB,
      versionANumber,
      versionBNumber,
      recommendedVersionNumber,
      recommendedSelection,
      canPromote,
      actualDiffSections: buildActualDiffSections(result),
      paneChangesA: paneChanges.a,
      paneChangesB: paneChanges.b,
      scoreImprovementA: result.recommended_id === 'a' ? getScoreImprovement(result.score_a, result.score_b) : null,
      scoreImprovementB: result.recommended_id === 'b' ? getScoreImprovement(result.score_b, result.score_a) : null,
      isARecommended: result.recommended_id === 'a',
      isBRecommended: result.recommended_id === 'b',
    };
  }, [state]);

  const exportReport = useCallback(() => {
    if (!state) return;
    downloadCompareReport(state);
    toast.success(copy.exportSuccess);
  }, [copy.exportSuccess, state]);

  const promoteRecommended = useCallback(async () => {
    if (!presentation?.canPromote) return;
    const { recommendedSelection, role, recommendedVersionNumber } = presentation;

    try {
      setPromoting(true);
      await restoreVersion(recommendedSelection.versionId, role);
      toast.success(copy.promoteSuccess(recommendedVersionNumber));
      navigate(`/resume-vault/r/${recommendedSelection.resumeId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, copy.promoteFailed));
    } finally {
      setPromoting(false);
    }
  }, [copy.promoteFailed, copy.promoteSuccess, navigate, presentation, restoreVersion]);

  return {
    state,
    presentation,
    promoting,
    exportReport,
    promoteRecommended,
  };
}
