import React from 'react';
import { BadgeCheck, Clock, Download, FileText, Wand2 } from 'lucide-react';

import VaultDocumentViewer from 'features/vault/components/VaultDocumentViewer';
import { VAULT_VERSION_DETAIL_COPY } from 'features/vault/constants/versionDetailContent';
import type { VaultVersion } from 'features/vault/types';

type VaultVersionDetailDocumentPanelProps = {
  version: VaultVersion;
  filename: string;
  fileSizeLabel?: string | null;
  lastAnalyzedLabel: string;
  reanalyzing: boolean;
  pendingRestore: boolean;
  pendingActive: boolean;
  showSetActive: boolean;
  showRestore: boolean;
  onReanalyze: () => void;
  onRestore: () => void;
  onSetActive: () => void;
  onOpenInBuilder: () => void;
  onDownload?: () => void;
  onBlobReady?: (blobUrl: string | null) => void;
  onFileSize?: (sizeBytes: number | null) => void;
};

export default function VaultVersionDetailDocumentPanel({
  version,
  filename,
  fileSizeLabel,
  lastAnalyzedLabel,
  reanalyzing,
  pendingRestore,
  pendingActive,
  showSetActive,
  showRestore,
  onReanalyze,
  onRestore,
  onSetActive,
  onOpenInBuilder,
  onDownload,
  onBlobReady,
  onFileSize,
}: VaultVersionDetailDocumentPanelProps) {
  const copy = VAULT_VERSION_DETAIL_COPY;

  return (
    <section className="vault-version-detail__document glass-panel">
      <div className="vault-version-detail__document-header">
        <div className="vault-version-detail__document-meta">
          <FileText className="h-6 w-6 shrink-0 text-[var(--color-outline)]" aria-hidden />
          <h2 className="vault-version-detail__document-title">{filename}</h2>
          {version.builder ? (
            <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-primary)]">
              Built in Vetta
            </span>
          ) : null}
          {fileSizeLabel ? (
            <span className="vault-version-detail__file-size">{fileSizeLabel}</span>
          ) : null}
        </div>
        {version.has_source_file && onDownload ? (
          <button type="button" onClick={onDownload} className="vault-version-detail__download-btn">
            <Download className="h-[18px] w-[18px]" aria-hidden />
            {copy.downloadPdf}
          </button>
        ) : null}
      </div>

      <div className="vault-version-detail__document-viewer">
        <VaultDocumentViewer
          version={version}
          embedded
          onBlobReady={onBlobReady}
          onFileSize={onFileSize}
        />
      </div>

      <div className="vault-version-detail__document-footer">
        <div className="vault-version-detail__analyzed">
          <Clock className="h-4 w-4" aria-hidden />
          <span>{lastAnalyzedLabel}</span>
        </div>
        <div className="vault-version-detail__actions">
          <button
            type="button"
            onClick={onOpenInBuilder}
            className="vault-version-detail__action-btn"
          >
            <Wand2 className="h-[18px] w-[18px]" aria-hidden />
            Open in Builder
          </button>
          <button
            type="button"
            disabled={reanalyzing}
            onClick={onReanalyze}
            className="vault-version-detail__action-btn"
          >
            {reanalyzing ? copy.reanalyzing : copy.reanalyze}
          </button>
          {showRestore ? (
            <button
              type="button"
              disabled={pendingRestore}
              onClick={onRestore}
              className="vault-version-detail__action-btn"
            >
              {pendingRestore ? copy.restoring : copy.restoreToHead}
            </button>
          ) : null}
          {showSetActive ? (
            <button
              type="button"
              disabled={pendingActive}
              onClick={onSetActive}
              className="vault-version-detail__action-btn vault-version-detail__action-btn--primary"
            >
              <BadgeCheck className="h-[18px] w-[18px]" aria-hidden />
              {pendingActive ? copy.settingActive : copy.setAsActive}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
