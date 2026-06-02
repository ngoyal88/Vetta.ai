import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, FileWarning, X } from 'lucide-react';

import type { VaultVersion } from 'features/vault/types';
import { useVaultResumeFile } from '../hooks/useVaultResumeFile';

type ResumePreviewOverlayProps = {
  open: boolean;
  onClose: () => void;
  version: VaultVersion | null;
  entryName?: string | null;
};

export function ResumePreviewOverlay({
  open,
  onClose,
  version,
  entryName,
}: ResumePreviewOverlayProps) {
  const { loading, error, filename, iframeSrc, blobUrl } = useVaultResumeFile({
    version,
    entryName,
    enabled: open,
  });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, handleClose]);

  if (!open) return null;

  return createPortal(
    <div className="resume-preview-overlay" role="presentation" onClick={handleClose}>
      <div
        className="resume-preview-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="resume-preview-overlay__header">
          <h2 id="resume-preview-title" className="type-label-md truncate text-[var(--color-on-surface)]">
            {filename}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {blobUrl ? (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in new tab"
                className="resume-deep-dive-action resume-deep-dive-action--icon !w-auto !px-3"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
            <button
              type="button"
              onClick={handleClose}
              className="resume-deep-dive-action resume-deep-dive-action--icon"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="resume-preview-overlay__body">
          {!version?.has_source_file ? (
            <div className="resume-preview-overlay__state">
              <FileWarning className="h-10 w-10 text-[var(--color-outline)]" aria-hidden />
              <p className="type-body-md mt-4 text-[var(--color-on-surface-variant)]">
                No source file stored for this version.
              </p>
              <p className="type-label-sm mt-2 text-[var(--color-outline)]">
                Re-upload the résumé in Vault to enable preview.
              </p>
            </div>
          ) : loading ? (
            <div className="resume-preview-overlay__state">
              <div className="resume-deep-dive-skeleton h-4 w-40" />
              <p className="type-body-md mt-4 text-[var(--color-on-surface-variant)]">
                Loading résumé…
              </p>
            </div>
          ) : error ? (
            <div className="resume-preview-overlay__state">
              <p className="type-body-md text-[var(--color-error)]">{error}</p>
            </div>
          ) : iframeSrc ? (
            <iframe
              title={`Preview of ${filename}`}
              src={iframeSrc}
              className="resume-preview-overlay__iframe"
            />
          ) : blobUrl ? (
            <div className="resume-preview-overlay__state">
              <p className="type-body-md text-[var(--color-on-surface-variant)]">
                Inline preview is only available for PDF files.
              </p>
              <a href={blobUrl} download={filename} className="resume-deep-dive-action mt-4 px-4">
                Download original
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
