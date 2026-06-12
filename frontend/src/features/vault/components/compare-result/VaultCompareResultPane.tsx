import React from 'react';

import { Link } from 'react-router-dom';

import { ArrowUpRight, ExternalLink } from 'lucide-react';



import VaultDocumentViewer from 'features/vault/components/VaultDocumentViewer';

import VaultComparePaneChanges from 'features/vault/components/compare-result/VaultComparePaneChanges';

import { VAULT_COMPARE_RESULT_COPY } from 'features/vault/constants/compareResultContent';

import type { ComparePaneSectionGroup, VaultVersion } from 'features/vault/types';

import { formatModifiedLabel } from 'features/vault/utils/compareResultPresentation';



export type CompareResultPaneSide = 'a' | 'b';



type VaultCompareResultPaneProps = {

  side: CompareResultPaneSide;

  resumeId: string;

  versionId: string;

  version: VaultVersion;

  versionNumber: number;

  score: number;

  scoreImprovement?: number | null;

  isRecommended: boolean;

  paneChanges: ComparePaneSectionGroup[];

};



export default function VaultCompareResultPane({

  side,

  resumeId,

  versionId,

  version,

  versionNumber,

  score,

  scoreImprovement,

  isRecommended,

  paneChanges,

}: VaultCompareResultPaneProps) {

  const copy = VAULT_COMPARE_RESULT_COPY;

  const isA = side === 'a';

  const paneLabel = copy.versionLabel(versionNumber);

  const modifiedLabel = formatModifiedLabel(version.created_at);



  return (

    <article

      className={[

        'vault-compare-result-pane glass-panel',

        isA ? 'vault-compare-result-pane--a' : 'vault-compare-result-pane--b',

        isRecommended ? 'vault-compare-result-pane--recommended' : '',

      ].join(' ')}

    >

      <div className="vault-compare-result-pane__header">

        <div className="flex min-w-0 items-center gap-3">

          <div

            className={[

              'vault-compare-result-pane__badge',

              isA ? 'vault-compare-result-pane__badge--a' : 'vault-compare-result-pane__badge--b',

            ].join(' ')}

          >

            {isA ? 'A' : 'B'}

          </div>

          <div className="min-w-0">

            <h3 className="type-label-md truncate text-[var(--color-on-surface)]">

              {paneLabel}

              {isRecommended ? (

                <span className="vault-compare-result-pane__recommended-tag">{copy.recommended}</span>

              ) : null}

            </h3>

            <p className="type-label-sm mt-0.5 uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">

              {copy.modified}: {modifiedLabel}

            </p>

          </div>

        </div>



        <div className="flex shrink-0 items-center gap-4">

          <div className="flex items-center gap-2">

            <span className="type-label-sm text-[var(--color-on-surface-variant)]">{copy.score}</span>

            <span

              className={[

                'type-headline-md',

                isRecommended ? 'text-[var(--color-tertiary)]' : 'text-[var(--color-on-surface)]',

              ].join(' ')}

            >

              {score}

            </span>

            {scoreImprovement != null && scoreImprovement > 0 ? (

              <span className="type-label-sm flex items-center text-[var(--color-tertiary)]">

                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />

                {scoreImprovement}

              </span>

            ) : null}

          </div>

          <div className="vault-compare-result-pane__divider" aria-hidden />

          <Link

            to={`/resume-vault/r/${resumeId}/${versionId}`}

            className="vault-compare-result-pane__detail-link"

          >

            {copy.openDetail}

            <ExternalLink className="h-4 w-4" aria-hidden />

          </Link>

        </div>

      </div>



      <div className="vault-compare-result-pane__viewer">

        <VaultDocumentViewer version={version} className="min-h-[22rem] lg:min-h-[28rem]" />

      </div>



      <VaultComparePaneChanges side={side} groups={paneChanges} />

    </article>

  );

}

