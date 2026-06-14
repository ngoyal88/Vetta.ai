import React, { memo } from 'react';
import { FileText } from 'lucide-react';

import { VAULT_LIBRARY_COPY } from 'features/vault/constants/libraryContent';
import type { VaultEntry } from 'features/vault/types';
import { formatVersionLabel, getVaultEntryScore } from 'features/vault/utils/scorePresentation';
import { formatRelativeUpdatedAt } from 'features/vault/utils/vaultUtils';
import VaultLibraryRowMenu from './VaultLibraryRowMenu';
import VaultScoreRing from './VaultScoreRing';

type VaultLibraryRowProps = {
  entry: VaultEntry;
  isActive: boolean;
  menuOpen: boolean;
  pendingAction: string | null;
  onOpen: (resumeId: string) => void;
  onToggleMenu: (resumeId: string) => void;
  onSetActive: (resumeId: string) => void;
  onDelete: (resumeId: string) => void;
};

function VaultLibraryRow({
  entry,
  isActive,
  menuOpen,
  pendingAction,
  onOpen,
  onToggleMenu,
  onSetActive,
  onDelete,
}: VaultLibraryRowProps) {
  const score = getVaultEntryScore(entry);
  const versionLabel = formatVersionLabel(entry.version_count);
  const updatedLabel = formatRelativeUpdatedAt(entry.last_updated ?? entry.created_at);
  const tags = entry.tags?.length ? entry.tags : [];

  return (
    <article
      className={[
        'vault-library-row glass-panel',
        isActive ? 'vault-library-row--active' : '',
        menuOpen ? 'vault-library-row--menu-open' : '',
      ].join(' ')}
    >
      {isActive ? <div className="vault-library-row__active-strip" aria-hidden /> : null}

      <div
        className={['vault-library-row__grid', isActive ? 'vault-library-row__grid--active' : ''].join(' ')}
      >
        <button
          type="button"
          onClick={() => onOpen(entry.id)}
          className="vault-library-row__open col-span-1 md:col-span-5 flex items-center gap-4 text-left"
        >
          <div
            className={[
              'vault-library-row__icon',
              isActive ? 'vault-library-row__icon--active' : '',
            ].join(' ')}
          >
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="type-body-md truncate font-semibold text-[var(--color-on-surface)]">
                {entry.name}
              </h3>
              {isActive ? (
                <span className="vault-library-row__active-badge">{VAULT_LIBRARY_COPY.activeBadge}</span>
              ) : null}
            </div>
            <p className="type-label-sm mt-0.5 text-[var(--color-on-surface-variant)]">{updatedLabel}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpen(entry.id)}
          className="vault-library-row__open col-span-1 md:col-span-2 flex items-center gap-2 md:justify-center"
        >
          <span className="type-label-sm text-[var(--color-on-surface-variant)] md:hidden">
            {VAULT_LIBRARY_COPY.columns.version}:
          </span>
          <span className="vault-library-row__version">{versionLabel}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpen(entry.id)}
          className="vault-library-row__open col-span-1 md:col-span-2 flex items-center gap-2 md:justify-center"
        >
          <span className="type-label-sm text-[var(--color-on-surface-variant)] md:hidden">
            {VAULT_LIBRARY_COPY.columns.aiScore}:
          </span>
          <VaultScoreRing score={score} />
        </button>

        <button
          type="button"
          onClick={() => onOpen(entry.id)}
          className="vault-library-row__open col-span-1 md:col-span-2 flex flex-wrap gap-1.5"
        >
          {tags.length ? (
            tags.map((tag) => (
              <span key={tag} className="vault-library-row__tag">
                {tag}
              </span>
            ))
          ) : (
            <span className="type-label-sm text-[var(--color-outline)]">—</span>
          )}
        </button>

        <div className="col-span-1 flex justify-end">
          <VaultLibraryRowMenu
            resumeId={entry.id}
            isActive={isActive}
            isOpen={menuOpen}
            pendingAction={pendingAction}
            onToggle={onToggleMenu}
            onOpen={onOpen}
            onSetActive={onSetActive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

const VaultLibraryRowMemo = memo(VaultLibraryRow);
export default VaultLibraryRowMemo;
