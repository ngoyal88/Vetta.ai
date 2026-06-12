import React from 'react';

import { Sparkles } from 'lucide-react';



import { VAULT_COMPARE_RESULT_COPY } from 'features/vault/constants/compareResultContent';

import type { VaultCompareResponse } from 'features/vault/types';

import {
  compareDocumentsAreSame,
  formatOnlyInLabel,
} from 'features/vault/utils/compareDiffPresentation';



type VaultCompareVerdictPanelProps = {

  result: VaultCompareResponse;

  nameA: string;

  nameB: string;

  versionANumber: number;

  versionBNumber: number;

  recommendedVersionNumber: number;

};



export default function VaultCompareVerdictPanel({

  result,

  nameA,

  nameB,

  versionANumber,

  versionBNumber,

  recommendedVersionNumber,

}: VaultCompareVerdictPanelProps) {

  const copy = VAULT_COMPARE_RESULT_COPY;

  const sameDocument = compareDocumentsAreSame(nameA, nameB);

  const onlyA = result.skills_only_in_a ?? [];

  const onlyB = result.skills_only_in_b ?? [];



  return (

    <section className="vault-compare-analysis glass-panel" aria-label="AI difference analysis">

      <div className="vault-compare-analysis__header">

        <div className="flex items-center gap-2">

          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />

          <h2 className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface)]">

            {copy.analysisTitle}

          </h2>

        </div>

        <span className="vault-compare-analysis__badge">

          {copy.recommended}: {copy.version.toUpperCase()} {recommendedVersionNumber}

        </span>

      </div>



      <div className="vault-compare-analysis__body">

        <div className="vault-compare-analysis__reason">

          <p className="type-body-md leading-relaxed text-[var(--color-on-surface-variant)]">

            <strong className="font-semibold text-[var(--color-on-surface)]">

              {copy.recommendationReason}:

            </strong>{' '}

            {result.recommendation_reason}

          </p>

          {result.diff_summary ? (

            <p className="type-body-md mt-3 leading-relaxed text-[var(--color-on-surface-variant)]">

              {result.diff_summary}

            </p>

          ) : null}

        </div>



        <div className="vault-compare-analysis__skills">

          <div>

            <h3 className="vault-compare-analysis__skills-label vault-compare-analysis__skills-label--removed">

              {formatOnlyInLabel(nameA, versionANumber, sameDocument)}

            </h3>

            <div className="flex flex-wrap gap-2">

              {onlyA.length ? (

                onlyA.map((skill) => (

                  <span key={skill} className="vault-compare-analysis__tag vault-compare-analysis__tag--removed">

                    {skill}

                  </span>

                ))

              ) : (

                <span className="type-label-sm text-[var(--color-outline)]">{copy.none}</span>

              )}

            </div>

          </div>



          <div>

            <h3 className="vault-compare-analysis__skills-label vault-compare-analysis__skills-label--added">

              {formatOnlyInLabel(nameB, versionBNumber, sameDocument)}

            </h3>

            <div className="flex flex-wrap gap-2">

              {onlyB.length ? (

                onlyB.map((skill) => (

                  <span key={skill} className="vault-compare-analysis__tag vault-compare-analysis__tag--added">

                    {skill}

                  </span>

                ))

              ) : (

                <span className="type-label-sm text-[var(--color-outline)]">{copy.none}</span>

              )}

            </div>

          </div>

        </div>

      </div>

    </section>

  );

}

