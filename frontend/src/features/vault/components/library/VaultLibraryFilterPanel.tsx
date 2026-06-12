import React from 'react';

import { VAULT_LIBRARY_COPY } from 'features/vault/constants/libraryContent';
import type { LibraryFilterMode, LibrarySortMode } from 'features/vault/hooks/useLibraryPage';

type VaultLibraryFilterPanelProps = {
  filterMode: LibraryFilterMode;
  sortMode: LibrarySortMode;
  onFilterModeChange: (mode: LibraryFilterMode) => void;
  onSortModeChange: (mode: LibrarySortMode) => void;
};

export default function VaultLibraryFilterPanel({
  filterMode,
  sortMode,
  onFilterModeChange,
  onSortModeChange,
}: VaultLibraryFilterPanelProps) {
  const copy = VAULT_LIBRARY_COPY.filterPanel;

  return (
    <div className="vault-library-filter glass-panel mt-3 rounded-xl p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="type-label-sm mb-2 text-[var(--color-on-surface-variant)]">
            {copy.showLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', copy.all],
                ['active', copy.activeOnly],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onFilterModeChange(value)}
                className={[
                  'vault-library-filter__chip',
                  filterMode === value ? 'vault-library-filter__chip--active' : '',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="type-label-sm mb-2 text-[var(--color-on-surface-variant)]">
            {copy.sortLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['updated', copy.sortUpdated],
                ['name', copy.sortName],
                ['score', copy.sortScore],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onSortModeChange(value)}
                className={[
                  'vault-library-filter__chip',
                  sortMode === value ? 'vault-library-filter__chip--active' : '',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
