import React from 'react';
import { Link } from 'react-router-dom';

import { VaultCompareHeader, VaultCompareWorkspace } from 'features/vault/components/compare';
import { VAULT_COMPARE_COPY } from 'features/vault/constants/compareContent';
import { useComparePage } from 'features/vault/hooks/useComparePage';

export type { CompareResultState, VersionSelection } from 'features/vault/types/compare';

export default function VaultComparePage() {
  const {
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
  } = useComparePage();

  const copy = VAULT_COMPARE_COPY;

  if (libraryLoading) {
    return (
      <>
        <VaultCompareHeader />
        <p className="type-body-md py-16 text-center text-[var(--color-on-surface-variant)]">
          {copy.loading}
        </p>
      </>
    );
  }

  if (!entries.length) {
    return (
      <>
        <VaultCompareHeader />
        <div className="glass-panel rounded-xl border border-dashed border-[var(--border-strong)] py-16 text-center">
          <p className="type-headline-md text-[var(--color-on-surface)]">{copy.emptyTitle}</p>
          <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">{copy.emptyBody}</p>
          <Link
            to="/resume-vault"
            className="type-label-md mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-container)] px-5 py-3 text-[var(--color-on-primary-container)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)]"
          >
            {copy.emptyAction}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <VaultCompareHeader />
      <VaultCompareWorkspace
        entries={entries}
        selectionA={selectionA}
        selectionB={selectionB}
        role={role}
        canSubmit={canSubmit}
        canCompare={canCompare}
        comparing={comparing}
        onSelectionAChange={setSelectionA}
        onSelectionBChange={setSelectionB}
        onRoleChange={setRole}
        onSubmit={() => void handleCompare()}
      />
    </>
  );
}
