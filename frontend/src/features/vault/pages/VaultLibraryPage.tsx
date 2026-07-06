import React from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

import {
  VaultLibraryHeader,
  VaultLibraryRow,
  VaultLibraryTableHeader,
} from 'features/vault/components/library';
import { VAULT_LIBRARY_COPY } from 'features/vault/constants/libraryContent';
import { useLibraryPage } from 'features/vault/hooks/useLibraryPage';
import PageLoadingState from 'shared/components/PageLoadingState';

export default function VaultLibraryPage() {
  const {
    visibleEntries,
    loading,
    error,
    filterOpen,
    filterMode,
    sortMode,
    openMenuId,
    pendingAction,
    refresh,
    toggleFilterPanel,
    changeFilterMode,
    changeSortMode,
    toggleRowMenu,
    openResume,
    setActiveResume,
    deleteResume,
    isEntryActive,
  } = useLibraryPage();

  return (
    <div className="app-container">
        <VaultLibraryHeader
          filterMode={filterMode}
          sortMode={sortMode}
          filterOpen={filterOpen}
          onToggleFilter={toggleFilterPanel}
          onFilterModeChange={changeFilterMode}
          onSortModeChange={changeSortMode}
        />

        {loading ? (
          <PageLoadingState variant="list" minHeightClassName="py-8" />
        ) : error ? (
          <div className="glass-panel rounded-xl py-16 text-center">
            <p className="type-body-md text-[var(--color-error)]">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="type-label-md mt-4 rounded-lg border border-[var(--border-strong)] px-4 py-2 text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-high)]"
            >
              {VAULT_LIBRARY_COPY.retry}
            </button>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="glass-panel rounded-xl border border-dashed border-[var(--border-strong)] py-16 text-center">
            <p className="type-headline-md text-[var(--color-on-surface)]">
              {VAULT_LIBRARY_COPY.emptyTitle}
            </p>
            <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
              {filterMode === 'active'
                ? VAULT_LIBRARY_COPY.emptyActiveFilter
                : VAULT_LIBRARY_COPY.emptyBody}
            </p>
            <Link
              to="/resume-vault"
              className="type-label-md mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-container)] px-5 py-3 text-[var(--color-on-primary-container)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)]"
            >
              {VAULT_LIBRARY_COPY.emptyAction}
            </Link>
          </div>
        ) : (
          <section className="space-y-4" aria-label="Resume library">
            <VaultLibraryTableHeader />
            <ul className="space-y-4">
              {visibleEntries.map((entry) => (
                <li key={entry.id}>
                  <VaultLibraryRow
                    entry={entry}
                    isActive={isEntryActive(entry)}
                    menuOpen={openMenuId === entry.id}
                    pendingAction={pendingAction}
                    onOpen={openResume}
                    onToggleMenu={toggleRowMenu}
                    onSetActive={setActiveResume}
                    onDelete={deleteResume}
                  />
                </li>
              ))}
            </ul>

            <p className="type-label-sm flex items-center justify-center gap-2 pt-4 text-[var(--color-on-surface-variant)] opacity-70">
              <Info className="h-4 w-4 shrink-0" aria-hidden />
              {VAULT_LIBRARY_COPY.footerTip}
            </p>
          </section>
        )}
    </div>
  );
}
