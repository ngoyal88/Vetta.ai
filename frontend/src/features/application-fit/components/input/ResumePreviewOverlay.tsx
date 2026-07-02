import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, FileText, X } from 'lucide-react';

import VaultDocumentViewer from 'features/vault/components/VaultDocumentViewer';
import type { VaultVersion } from 'features/vault/types';

import { ParsedResumePreview } from './ParsedResumePreview';

type ResumePreviewOverlayProps = {
  open: boolean;
  onClose: () => void;
  version: VaultVersion | null;
  entryName: string;
};

type ResumePreviewMode = 'parsed' | 'original';

export function ResumePreviewOverlay({
  open,
  onClose,
  version,
  entryName,
}: ResumePreviewOverlayProps) {
  const [mode, setMode] = useState<ResumePreviewMode>('parsed');

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setMode('parsed');
    }
  }, [open, version?.id]);

  if (!open) return null;

  const title = version?.source_filename || entryName;

  return createPortal(
    <div className="application-fit-resume-overlay" role="presentation" onClick={onClose}>
      <div
        className="application-fit-resume-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-fit-resume-overlay-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="application-fit-resume-overlay__header">
          <div className="min-w-0">
            <h2
              id="application-fit-resume-overlay-title"
              className="type-headline-md truncate text-[var(--color-on-surface)]"
            >
              {title}
            </h2>
            <p className="application-fit-resume-overlay__subtitle type-body-sm text-[var(--color-on-surface-variant)]">
              See the structured resume data or switch to the original file preview.
            </p>
          </div>

          <div className="application-fit-resume-overlay__header-actions">
            <div className="application-fit-resume-overlay__switch" role="tablist" aria-label="Resume preview mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'parsed'}
                className={`application-fit-resume-overlay__switch-btn ${
                  mode === 'parsed' ? 'application-fit-resume-overlay__switch-btn--active' : ''
                }`}
                onClick={() => setMode('parsed')}
              >
                <Eye className="h-4 w-4" aria-hidden />
                Parsed Resume
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'original'}
                className={`application-fit-resume-overlay__switch-btn ${
                  mode === 'original' ? 'application-fit-resume-overlay__switch-btn--active' : ''
                }`}
                onClick={() => setMode('original')}
              >
                <FileText className="h-4 w-4" aria-hidden />
                Original PDF
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="application-fit-resume-overlay__close"
              aria-label="Close resume preview"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div
          className={`application-fit-resume-overlay__body ${
            mode === 'original'
              ? 'application-fit-resume-overlay__body--pdf'
              : 'application-fit-resume-overlay__body--parsed'
          }`}
        >
          {mode === 'parsed' ? (
            <ParsedResumePreview profile={version?.profile_snapshot ?? null} />
          ) : (
            <VaultDocumentViewer version={version} embedded className="application-fit-resume-overlay__viewer" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
