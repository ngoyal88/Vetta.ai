import React from 'react';
import { Link } from 'react-router-dom';
import { Bolt, Pencil, Plus, Wand2 } from 'lucide-react';

import { VAULT_VERSIONS_COPY } from 'features/vault/constants/versionsContent';
import type { VaultEntry, VaultVersion } from 'features/vault/types';
import { formatVersionLabel } from 'features/vault/utils/scorePresentation';

type VaultVersionsHeaderProps = {
  entry: VaultEntry | undefined;
  headVersion: VaultVersion | null;
  compatScore: number | null;
  onEdit: () => void;
  onAddVersion: () => void;
};

export default function VaultVersionsHeader({
  entry,
  headVersion,
  compatScore,
  onEdit,
  onAddVersion,
}: VaultVersionsHeaderProps) {
  const copy = VAULT_VERSIONS_COPY;
  const headLabel = headVersion
    ? `v${headVersion.version_number}`
    : entry
      ? formatVersionLabel(entry.version_count)
      : '—';

  return (
    <header className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <h1 className="type-headline-lg tracking-tight text-[var(--color-on-surface)]">
          {entry?.name || 'Resume'}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="vault-versions-head-badge">{headLabel}</span>
          {entry?.origin === 'builder' ? (
            <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-primary)]">
              Built in Vetta
            </span>
          ) : null}
          {compatScore != null ? (
            <div className="type-label-md flex items-center gap-2 text-[var(--color-on-surface-variant)]">
              <span>{copy.compatScore}:</span>
              <span className="flex items-center gap-1 text-[var(--color-tertiary)]">
                <Bolt className="h-4 w-4" aria-hidden />
                {compatScore}
              </span>
            </div>
          ) : null}
          {entry?.is_active ? (
            <span className="vault-versions-active-pill">
              <span className="vault-versions-active-pill__dot" aria-hidden />
              {copy.active}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          disabled={!entry}
          className="vault-versions-action-btn"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          {copy.editDetails}
        </button>
        {entry ? (
          <Link
            to={`/resume-vault/builder?resumeId=${encodeURIComponent(entry.id)}`}
            className="vault-versions-action-btn"
          >
            <Wand2 className="h-4 w-4" aria-hidden />
            Open in Builder
          </Link>
        ) : null}
        {entry ? (
          <button
            type="button"
            onClick={onAddVersion}
            className="vault-versions-action-btn vault-versions-action-btn--primary"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {copy.newVersion}
          </button>
        ) : null}
      </div>
    </header>
  );
}
