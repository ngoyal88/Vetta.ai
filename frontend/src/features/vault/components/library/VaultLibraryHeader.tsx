import React from 'react';
import { Link } from 'react-router-dom';
import { Filter, Upload } from 'lucide-react';

import { VAULT_LIBRARY_COPY } from 'features/vault/constants/libraryContent';
import type { LibraryFilterMode, LibrarySortMode } from 'features/vault/hooks/useLibraryPage';
import VaultLibraryFilterPanel from './VaultLibraryFilterPanel';

type VaultLibraryHeaderProps = {
  filterOpen: boolean;
  filterMode: LibraryFilterMode;
  sortMode: LibrarySortMode;
  onToggleFilter: () => void;
  onFilterModeChange: (mode: LibraryFilterMode) => void;
  onSortModeChange: (mode: LibrarySortMode) => void;
};

export default function VaultLibraryHeader({
  filterOpen,
  filterMode,
  sortMode,
  onToggleFilter,
  onFilterModeChange,
  onSortModeChange,
}: VaultLibraryHeaderProps) {
  const copy = VAULT_LIBRARY_COPY;

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl min-w-0">
          <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
            {copy.eyebrow}
          </p>
          <h1 className="type-display-lg mt-2 text-[var(--color-on-surface)]">{copy.title}</h1>
          <p className="type-body-lg mt-4 text-[var(--color-on-surface-variant)]">{copy.subtitle}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleFilter}
            aria-expanded={filterOpen}
            className="vault-library-action-btn"
          >
            <Filter className="h-4 w-4" aria-hidden />
            {copy.filter}
          </button>
          <Link to="/resume-vault" className="vault-library-action-btn vault-library-action-btn--filled">
            <Upload className="h-4 w-4" aria-hidden />
            {copy.upload}
          </Link>
        </div>
      </div>

      {filterOpen ? (
        <VaultLibraryFilterPanel
          filterMode={filterMode}
          sortMode={sortMode}
          onFilterModeChange={onFilterModeChange}
          onSortModeChange={onSortModeChange}
        />
      ) : null}
    </header>
  );
}
