import React from 'react';
import { ArrowRight, Download } from 'lucide-react';

import { VAULT_COMPARE_RESULT_COPY } from 'features/vault/constants/compareResultContent';
import { compareDocumentsAreSame } from 'features/vault/utils/compareDiffPresentation';
import { formatCompareTitle } from 'features/vault/utils/compareResultPresentation';

type VaultCompareResultHeaderProps = {
  nameA: string;
  nameB: string;
  versionANumber: number;
  versionBNumber: number;
  role?: string;
  recommendedVersionNumber: number;
  canPromote: boolean;
  promoting: boolean;
  onExport: () => void;
  onPromote: () => void;
};

export default function VaultCompareResultHeader({
  nameA,
  nameB,
  versionANumber,
  versionBNumber,
  role,
  recommendedVersionNumber,
  canPromote,
  promoting,
  onExport,
  onPromote,
}: VaultCompareResultHeaderProps) {
  const copy = VAULT_COMPARE_RESULT_COPY;
  const sameDocument = compareDocumentsAreSame(nameA, nameB);

  return (
    <header className="vault-compare-result-header">
      <div className="min-w-0">
        <h1 className="type-headline-lg flex flex-wrap items-center gap-3 text-[var(--color-on-surface)]">
          {formatCompareTitle(nameA, nameB, versionANumber, versionBNumber)}
          <span className="vault-compare-result-header__verified">
            <span className="vault-compare-result-header__verified-dot" aria-hidden />
            {copy.aiVerified}
          </span>
        </h1>
        <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
          {copy.targetRole}: {role?.trim() || copy.targetRoleUnset}
          {!sameDocument ? (
            <span className="vault-compare-result-header__documents">
              {' '}
              · v{versionANumber} vs v{versionBNumber}
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button type="button" onClick={onExport} className="vault-compare-result-header__btn">
          <Download className="h-4 w-4" aria-hidden />
          {copy.exportReport}
        </button>
        {canPromote ? (
          <button
            type="button"
            disabled={promoting}
            onClick={() => void onPromote()}
            className="vault-compare-result-header__btn vault-compare-result-header__btn--primary"
          >
            {promoting ? copy.promoting : `${copy.promote} v${recommendedVersionNumber}`}
            {!promoting ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
          </button>
        ) : null}
      </div>
    </header>
  );
}
