import React, { useEffect, useState } from 'react';
import { BadgeCheck, Clock, Download, FileText, Wand2 } from 'lucide-react';

import { ParsedResumePreview } from 'features/application-fit/components/input/ParsedResumePreview';
import VaultDocumentViewSwitch, {
  type VaultDocumentViewMode,
} from 'features/vault/components/VaultDocumentViewSwitch';
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
  const hasPdf = Boolean(version.has_source_file);
  const hasParsed = Boolean(version.profile_snapshot);
  const showViewToggle = hasPdf && hasParsed;
  const [documentView, setDocumentView] = useState<VaultDocumentViewMode>(hasPdf ? 'pdf' : 'parsed');
  const [pdfPanelMounted, setPdfPanelMounted] = useState(hasPdf);

  useEffect(() => {
    setDocumentView(hasPdf ? 'pdf' : 'parsed');
    setPdfPanelMounted(hasPdf);
  }, [hasPdf, version.id]);

  useEffect(() => {
    if (documentView === 'pdf' && hasPdf) {
      setPdfPanelMounted(true);
    }
  }, [documentView, hasPdf]);

  const viewerClassName = [
    'vault-version-detail__document-viewer',
    documentView === 'parsed' ? 'vault-version-detail__document-viewer--parsed' : '',
    showViewToggle ? 'vault-version-detail__document-viewer--tabs' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="vault-version-detail__document glass-panel">
      <div className="vault-version-detail__document-header">
        <div className="vault-version-detail__document-header-row">
          <div className="vault-version-detail__document-meta">
            <FileText className="h-5 w-5 shrink-0 text-[var(--color-outline)]" aria-hidden />
            <div className="vault-version-detail__document-title-wrap">
              <h2 className="vault-version-detail__document-title" title={filename}>
                {filename}
              </h2>
              <div className="vault-version-detail__document-badges">
                {version.builder ? (
                  <span className="vault-version-detail__builder-badge">Built in Vetta</span>
                ) : null}
                {fileSizeLabel ? (
                  <span className="vault-version-detail__file-size">{fileSizeLabel}</span>
                ) : null}
              </div>
            </div>
          </div>
          {version.has_source_file && onDownload ? (
            <button type="button" onClick={onDownload} className="vault-version-detail__download-btn">
              <Download className="h-[18px] w-[18px]" aria-hidden />
              {copy.downloadPdf}
            </button>
          ) : null}
        </div>

        {showViewToggle ? (
          <VaultDocumentViewSwitch mode={documentView} onChange={setDocumentView} fullWidth />
        ) : null}
      </div>

      <div className={viewerClassName}>
        {showViewToggle ? (
          <>
            {hasParsed ? (
              <div
                role="tabpanel"
                id="vault-version-document-parsed"
                aria-label={copy.viewParsedResume}
                hidden={documentView !== 'parsed'}
                className="vault-version-detail__document-panel vault-version-detail__document-panel--parsed"
              >
                <div className="vault-version-detail__parsed-resume">
                  <ParsedResumePreview profile={version.profile_snapshot} />
                </div>
              </div>
            ) : null}
            {hasPdf && pdfPanelMounted ? (
              <div
                role="tabpanel"
                id="vault-version-document-pdf"
                aria-label={copy.viewOriginalPdf}
                hidden={documentView !== 'pdf'}
                className="vault-version-detail__document-panel vault-version-detail__document-panel--pdf"
              >
                <VaultDocumentViewer
                  version={version}
                  embedded
                  onBlobReady={onBlobReady}
                  onFileSize={onFileSize}
                />
              </div>
            ) : null}
          </>
        ) : documentView === 'parsed' && hasParsed ? (
          <div className="vault-version-detail__parsed-resume">
            <ParsedResumePreview profile={version.profile_snapshot} />
          </div>
        ) : (
          <VaultDocumentViewer
            version={version}
            embedded
            onBlobReady={onBlobReady}
            onFileSize={onFileSize}
          />
        )}
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
