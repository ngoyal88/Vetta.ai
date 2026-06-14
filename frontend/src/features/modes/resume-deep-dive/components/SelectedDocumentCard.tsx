import React from 'react';
import { ArrowLeftRight, ExternalLink, Eye, FileSearch } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { ResumeProfile, VaultEntry, VaultVersion } from 'features/vault/types';
import { resumeDisplayName } from 'features/modes/shared/utils/resumeDisplayName';
import {
  documentFileLabel,
  documentMetaLine,
  formatVaultDate,
  roleProjectSummary,
} from '../utils/resumeDeepDiveUtils';

type SelectedDocumentCardProps = {
  loading: boolean;
  profile: ResumeProfile | null;
  entry: VaultEntry | null;
  version: VaultVersion | null;
  integrityScore: number;
  uploadedLabel: string;
  onPreview: () => void;
};

export function SelectedDocumentCard({
  loading,
  profile,
  entry,
  version,
  integrityScore,
  uploadedLabel,
  onPreview,
}: SelectedDocumentCardProps) {
  const canPreview = Boolean(version?.has_source_file);
  const summary = roleProjectSummary(profile);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col">
        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading resume">
            <div className="resume-deep-dive-skeleton h-20 w-full rounded-xl" />
            <div className="resume-deep-dive-skeleton h-4 w-3/4" />
            <div className="resume-deep-dive-skeleton h-4 w-1/2" />
            <div className="resume-deep-dive-skeleton h-4 w-2/3" />
          </div>
        ) : profile ? (
          <>
            <div className="mb-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-lowest)]/50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-highest)]">
                  <FileSearch className="h-5 w-5 text-[var(--color-outline)]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="type-label-md min-w-0 flex-1 truncate text-[var(--color-on-surface)]">
                      {documentFileLabel(version, entry)}
                    </p>
                    <button
                      type="button"
                      onClick={onPreview}
                      disabled={!canPreview}
                      className="resume-deep-dive-preview-btn"
                      aria-label="Preview resume"
                      title={canPreview ? 'Preview resume' : 'No file available to preview'}
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="type-label-sm mt-1 text-[var(--color-on-surface-variant)]">
                    {entry?.version_count ?? 1} version
                    {(entry?.version_count ?? 1) === 1 ? '' : 's'} · {documentMetaLine(version)}
                  </p>
                  {summary ? (
                    <p className="type-label-sm mt-1 text-[var(--color-outline)]">
                      {resumeDisplayName(profile)} · {summary}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <dl className="space-y-0">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-3">
                <dt className="type-label-sm text-[var(--color-on-surface-variant)]">Uploaded date</dt>
                <dd className="type-body-md font-medium text-[var(--color-on-surface)]">
                  {uploadedLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-3">
                <dt className="type-label-sm text-[var(--color-on-surface-variant)]">Profile version</dt>
                <dd className="type-body-md font-medium text-[var(--color-on-surface)]">
                  v{version?.version_number ?? 1}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="type-label-sm text-[var(--color-on-surface-variant)]">Data integrity</dt>
                <dd className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-surface-container-high)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-secondary)] transition-all duration-300"
                      style={{ width: `${integrityScore}%` }}
                    />
                  </div>
                  <span className="type-label-md font-semibold tabular-nums text-[var(--color-secondary)]">
                    {integrityScore}%
                  </span>
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="flex flex-1 flex-col justify-center rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-5">
            <p className="type-body-md text-[var(--color-error)]">No active resume found in Vault.</p>
            <p className="type-label-sm mt-2 text-[var(--color-on-surface-variant)]">
              Upload and set a résumé as active before starting a deep-dive.
            </p>
            <Link to="/resume-vault" className="resume-deep-dive-action mt-4 w-fit px-4">
              Open Resume Vault
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3 border-t border-[var(--border-subtle)] pt-6">
        <Link to="/resume-vault" className="resume-deep-dive-action flex-1">
          <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
          Change resume
        </Link>
        <Link
          to="/resume-vault"
          className="resume-deep-dive-action resume-deep-dive-action--icon"
          aria-label="Open resume in vault"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
