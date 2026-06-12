import React from 'react';

import {
  VaultCompareActualDiff,
  VaultCompareResultEmptyState,
  VaultCompareResultHeader,
  VaultCompareResultPane,
  VaultCompareVerdictPanel,
} from 'features/vault/components/compare-result';
import { useCompareResultPage } from 'features/vault/hooks/useCompareResultPage';

export default function VaultCompareResultPage() {
  const { presentation, promoting, exportReport, promoteRecommended } = useCompareResultPage();

  if (!presentation) {
    return <VaultCompareResultEmptyState />;
  }

  const {
    result,
    selectionA,
    selectionB,
    role,
    nameA,
    nameB,
    versionANumber,
    versionBNumber,
    recommendedVersionNumber,
    canPromote,
    actualDiffSections,
    paneChangesA,
    paneChangesB,
    scoreImprovementA,
    scoreImprovementB,
    isARecommended,
    isBRecommended,
  } = presentation;

  return (
    <div className="vault-compare-result-page">
      <VaultCompareResultHeader
        nameA={nameA}
        nameB={nameB}
        versionANumber={versionANumber}
        versionBNumber={versionBNumber}
        role={role}
        recommendedVersionNumber={recommendedVersionNumber}
        canPromote={canPromote}
        promoting={promoting}
        onExport={exportReport}
        onPromote={promoteRecommended}
      />

      <VaultCompareVerdictPanel
        result={result}
        nameA={nameA}
        nameB={nameB}
        versionANumber={versionANumber}
        versionBNumber={versionBNumber}
        recommendedVersionNumber={recommendedVersionNumber}
      />

      <div className="vault-compare-result-page__panes">
        <VaultCompareResultPane
          side="a"
          resumeId={selectionA.resumeId}
          versionId={selectionA.versionId}
          version={selectionA.version}
          versionNumber={versionANumber}
          score={result.score_a}
          scoreImprovement={scoreImprovementA}
          isRecommended={isARecommended}
          paneChanges={paneChangesA}
        />
        <VaultCompareResultPane
          side="b"
          resumeId={selectionB.resumeId}
          versionId={selectionB.versionId}
          version={selectionB.version}
          versionNumber={versionBNumber}
          score={result.score_b}
          scoreImprovement={scoreImprovementB}
          isRecommended={isBRecommended}
          paneChanges={paneChangesB}
        />
      </div>

      <VaultCompareActualDiff
        sections={actualDiffSections}
        nameA={nameA}
        nameB={nameB}
        versionANumber={versionANumber}
        versionBNumber={versionBNumber}
      />
    </div>
  );
}
