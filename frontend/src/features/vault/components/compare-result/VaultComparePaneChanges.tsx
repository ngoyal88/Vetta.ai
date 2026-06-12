import React from 'react';



import { VAULT_COMPARE_RESULT_COPY } from 'features/vault/constants/compareResultContent';

import type { ComparePaneSectionGroup } from 'features/vault/types';

import type { CompareResultPaneSide } from './VaultCompareResultPane';



type VaultComparePaneChangesProps = {

  side: CompareResultPaneSide;

  groups: ComparePaneSectionGroup[];

};



export default function VaultComparePaneChanges({ side, groups }: VaultComparePaneChangesProps) {

  const copy = VAULT_COMPARE_RESULT_COPY;

  const isA = side === 'a';



  if (!groups.length) {

    return null;

  }



  return (

    <footer className="vault-compare-pane-changes" aria-label="Changes in this resume">

      {groups.map((group) => (

        <div

          key={group.section}

          className={[

            'vault-compare-pane-changes__highlight',

            isA ? 'vault-compare-pane-changes__highlight--a' : 'vault-compare-pane-changes__highlight--b',

          ].join(' ')}

        >

          <div className="vault-compare-pane-changes__highlight-head">

            <span className="vault-compare-pane-changes__highlight-label">

              {isA ? `— ${copy.uniqueSectionA}` : `+ ${copy.uniqueSectionB}`}

            </span>

            <span className="vault-compare-pane-changes__section-label">{group.label}</span>

          </div>

          <ul className="vault-compare-pane-changes__items">

            {group.items.map((item) => (

              <li key={`${group.section}-${item}`} className="vault-compare-pane-changes__item">

                {item}

              </li>

            ))}

          </ul>

        </div>

      ))}

    </footer>

  );

}

