import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GitCompare } from 'lucide-react';

import { VAULT_COMPARE_RESULT_COPY } from 'features/vault/constants/compareResultContent';

export default function VaultCompareResultEmptyState() {
  const copy = VAULT_COMPARE_RESULT_COPY;

  return (
    <section className="vault-compare-result-empty glass-panel">
      <div className="vault-compare-result-empty__icon" aria-hidden>
        <GitCompare className="h-8 w-8" />
      </div>
      <h1 className="type-headline-md text-[var(--color-on-surface)]">{copy.noComparisonTitle}</h1>
      <p className="type-body-md mt-2 max-w-md text-[var(--color-on-surface-variant)]">
        {copy.noComparisonBody}
      </p>
      <Link to="/resume-vault/compare" className="vault-compare-result-empty__cta">
        {copy.backToCompare}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}
