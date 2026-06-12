import React, { useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { VAULT_COMPARE_RESULT_COPY } from 'features/vault/constants/compareResultContent';

import type { CompareSectionDiff } from 'features/vault/types';

import {
  compareDocumentsAreSame,
  formatCompareSideLabel,
  formatOnlyInLabel,
} from 'features/vault/utils/compareDiffPresentation';

type VaultCompareActualDiffProps = {
  sections: CompareSectionDiff[];
  nameA: string;
  nameB: string;
  versionANumber: number;
  versionBNumber: number;
};

export default function VaultCompareActualDiff({
  sections,
  nameA,
  nameB,
  versionANumber,
  versionBNumber,
}: VaultCompareActualDiffProps) {
  const copy = VAULT_COMPARE_RESULT_COPY;
  const [expanded, setExpanded] = useState(false);
  const sameDocument = compareDocumentsAreSame(nameA, nameB);

  if (!sections.length) {
    return null;
  }

  return (
    <section className="vault-compare-actual-diff glass-panel" aria-label="Detailed differences">
      <button
        type="button"
        className="vault-compare-actual-diff__toggle"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <span>{expanded ? copy.hideAllDifferences : copy.viewAllDifferences}</span>
        <ChevronDown
          className={['h-4 w-4 transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="vault-compare-actual-diff__sections">
          {sections.map((section) => (
            <article key={section.section} className="vault-compare-actual-diff__section">
              <h3 className="vault-compare-actual-diff__section-title">{section.label}</h3>

              {section.only_in_a.length ? (
                <div className="vault-compare-actual-diff__group">
                  <h4 className="vault-compare-actual-diff__group-label vault-compare-actual-diff__group-label--a">
                    {formatOnlyInLabel(nameA, versionANumber, sameDocument)}
                  </h4>
                  <ul className="vault-compare-actual-diff__list">
                    {section.only_in_a.map((item) => (
                      <li key={`a-${section.section}-${item}`} className="vault-compare-actual-diff__item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {section.only_in_b.length ? (
                <div className="vault-compare-actual-diff__group">
                  <h4 className="vault-compare-actual-diff__group-label vault-compare-actual-diff__group-label--b">
                    {formatOnlyInLabel(nameB, versionBNumber, sameDocument)}
                  </h4>
                  <ul className="vault-compare-actual-diff__list">
                    {section.only_in_b.map((item) => (
                      <li key={`b-${section.section}-${item}`} className="vault-compare-actual-diff__item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {section.changed.length ? (
                <div className="vault-compare-actual-diff__group">
                  <h4 className="vault-compare-actual-diff__group-label">{copy.rewritten}</h4>
                  <div className="vault-compare-actual-diff__rewrites">
                    {section.changed.map((row) => (
                      <div
                        key={`${section.section}-${row.label}-${row.before}`}
                        className="vault-compare-actual-diff__rewrite"
                      >
                        <span className="vault-compare-actual-diff__rewrite-label">{row.label}</span>
                        <div className="vault-compare-actual-diff__rewrite-cols">
                          <p className="vault-compare-actual-diff__rewrite-col vault-compare-actual-diff__rewrite-col--a">
                            <span className="vault-compare-actual-diff__rewrite-side">
                              {formatCompareSideLabel('a', nameA, versionANumber, sameDocument)}
                            </span>
                            {row.before}
                          </p>
                          <p className="vault-compare-actual-diff__rewrite-col vault-compare-actual-diff__rewrite-col--b">
                            <span className="vault-compare-actual-diff__rewrite-side">
                              {formatCompareSideLabel('b', nameB, versionBNumber, sameDocument)}
                            </span>
                            {row.after}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
