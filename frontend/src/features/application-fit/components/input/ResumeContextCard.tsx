import { FileText, CheckCircle2, ArrowLeftRight, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { VaultEntry, VaultVersion } from 'features/vault/types';
import { formatVersionDate } from 'features/vault/utils/vaultUtils';

type ResumeContextCardProps = {
  entry: VaultEntry | null;
  version: VaultVersion | null;
  loading: boolean;
  onPreviewResume: () => void;
};

export function ResumeContextCard({ entry, version, loading, onPreviewResume }: ResumeContextCardProps) {
  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-label-md text-[var(--color-on-surface)]">Active resume</h2>
        <div className="flex items-center gap-2">
          {entry && version ? (
            <button
              type="button"
              onClick={onPreviewResume}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 type-label-sm text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)]"
              aria-label="Preview parsed resume and original file"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
              View
            </button>
          ) : null}
          <Link
            to="/resume-vault/library"
            className="type-label-sm text-[var(--color-primary)] hover:text-[var(--color-primary-fixed)] inline-flex items-center gap-1"
          >
            Change
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="application-fit-panel-divider" aria-hidden />

      {loading ? (
        <div className="mt-5 h-16 application-fit-skeleton rounded-lg bg-[var(--color-surface-container-high)]" />
      ) : entry && version ? (
        <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-outline-variant)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-surface-container-highest)_92%,var(--color-surface-container-low))] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]">
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm text-[var(--color-on-surface)]">
              {version.source_filename || entry.name || 'Resume'}
            </p>
            <p className="type-label-sm text-[var(--color-on-surface-variant)]">
              Last updated: {formatVersionDate(version.created_at)}
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-tertiary)]" aria-hidden />
        </div>
      ) : (
        <div className="mt-5 rounded-[var(--radius-lg)] border border-dashed border-[color-mix(in_srgb,var(--color-outline-variant)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--color-surface-container-low))] p-6 text-center">
          <p className="type-body-md mb-3 text-[var(--color-on-surface-variant)]">
            Upload a resume to Vault to get your full diagnosis.
          </p>
          <Link to="/resume-vault" className="btn-primary inline-flex">
            Upload resume
          </Link>
        </div>
      )}
    </div>
  );
}
