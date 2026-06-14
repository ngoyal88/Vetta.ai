import React, { memo } from 'react';
import { Download, RotateCcw, Sparkles, Wand2 } from 'lucide-react';

import { VAULT_VERSIONS_COPY } from 'features/vault/constants/versionsContent';
import type { VaultVersion } from 'features/vault/types';
import {
  getVaultScoreTier,
  getVaultScoreRingClass,
  normalizeVaultScore,
} from 'features/vault/utils/scorePresentation';
import { formatVersionDate, truncateFilename } from 'features/vault/utils/vaultUtils';

type VaultVersionCardProps = {
  version: VaultVersion;
  isCurrent: boolean;
  pendingAction: string | null;
  onPreview: (versionId: string) => void;
  onDownload: (version: VaultVersion) => void;
  onCompare: (version: VaultVersion) => void;
  onRestore: (versionId: string) => void;
};

function VaultVersionCard({
  version,
  isCurrent,
  pendingAction,
  onPreview,
  onDownload,
  onCompare,
  onRestore,
}: VaultVersionCardProps) {
  const copy = VAULT_VERSIONS_COPY;
  const versionLabel = `v${version.version_number}`;
  const score = normalizeVaultScore(version.score_at_version ?? version.latest_score ?? null);
  const scoreTier = getVaultScoreTier(score);
  const scoreClass = getVaultScoreRingClass(scoreTier);
  const filename = version.source_filename || `resume-${versionLabel}`;
  const truncatedFilename = truncateFilename(filename);
  const isRestoring = pendingAction === `restore-${version.id}`;
  const isDownloading = pendingAction === `download-${version.id}`;
  const isComparing = pendingAction === `compare-${version.id}`;

  return (
    <article
      className={[
        'vault-version-card',
        isCurrent ? 'vault-version-card--current' : '',
      ].join(' ')}
    >
      {isCurrent ? <div className="vault-version-card__accent" aria-hidden /> : null}

      <div className="vault-version-card__header">
        <div className="flex items-center gap-3">
          <span className="type-headline-md text-[var(--color-on-surface)]">{versionLabel}</span>
          {isCurrent ? (
            <span className="vault-version-card__head-badge">{copy.currentHead}</span>
          ) : null}
        </div>
      </div>

      <dl className="vault-version-card__meta">
        <div className="vault-version-card__meta-row">
          <dt>{copy.created}</dt>
          <dd>{formatVersionDate(version.created_at)}</dd>
        </div>
        <div className="vault-version-card__meta-row">
          <dt>{copy.filename}</dt>
          <dd title={filename}>{truncatedFilename}</dd>
        </div>
        <div className="vault-version-card__meta-row">
          <dt>{copy.atsScore}</dt>
          <dd className={['flex items-center gap-1.5', scoreClass].join(' ')}>
            <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
            <span className={score != null && scoreTier === 'excellent' ? 'font-bold' : ''}>
              {score != null ? `${score}/100` : '—'}
            </span>
          </dd>
        </div>
      </dl>

      <hr className="vault-version-card__divider" />

      <div className={['vault-version-card__notes', isCurrent ? '' : 'vault-version-card__notes--muted'].join(' ')}>
        <div>
          <h4 className="vault-version-card__section-label">{copy.userNote}</h4>
          <p className="type-body-md text-[var(--color-on-surface)]">
            {version.user_note?.trim() || copy.noUserNote}
          </p>
        </div>
        <div className="vault-version-card__diff">
          <h4 className="vault-version-card__diff-label">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {copy.aiDiffSummary}
          </h4>
          <p className="type-label-md line-clamp-2 leading-relaxed text-[var(--color-on-surface-variant)]">
            {version.diff_summary?.trim() || copy.noDiffSummary}
          </p>
        </div>
      </div>

      {isCurrent ? (
        <div className="vault-version-card__actions vault-version-card__actions--filled">
          <button
            type="button"
            className="vault-version-card__btn vault-version-card__btn--secondary"
            onClick={() => onPreview(version.id)}
          >
            {copy.preview}
          </button>
          <button
            type="button"
            disabled={!version.has_source_file || isDownloading}
            className="vault-version-card__btn vault-version-card__btn--secondary"
            onClick={() => void onDownload(version)}
          >
            <Download className="h-4 w-4" aria-hidden />
            {isDownloading ? copy.downloading : copy.pdf}
          </button>
        </div>
      ) : (
        <div className="vault-version-card__actions">
          <button
            type="button"
            disabled={isComparing}
            className="vault-version-card__btn vault-version-card__btn--ghost"
            onClick={() => void onCompare(version)}
          >
            {isComparing ? copy.comparing : copy.compare}
          </button>
          <button
            type="button"
            disabled={isRestoring}
            className="vault-version-card__btn vault-version-card__btn--ghost-muted"
            onClick={() => void onRestore(version.id)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {isRestoring ? copy.restoring : copy.restore}
          </button>
        </div>
      )}
    </article>
  );
}

const VaultVersionCardMemo = memo(VaultVersionCard);
export default VaultVersionCardMemo;
