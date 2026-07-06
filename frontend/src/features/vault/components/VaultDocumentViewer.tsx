import React, { useEffect, useRef, useState } from 'react';

import { VAULT_VERSION_DETAIL_COPY } from '../constants/versionDetailContent';
import { vaultApi } from '../services/vaultApi';
import type { VaultVersion } from '../types';
import { getErrorMessage } from '../utils/vaultUtils';

interface VaultDocumentViewerProps {
  version: VaultVersion | null;
  className?: string;
  embedded?: boolean;
  onBlobReady?: (blobUrl: string | null) => void;
  onFileSize?: (sizeBytes: number | null) => void;
}

export default function VaultDocumentViewer({
  version,
  className = '',
  embedded = false,
  onBlobReady,
  onFileSize,
}: VaultDocumentViewerProps) {
  const copy = VAULT_VERSION_DETAIL_COPY;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const onBlobReadyRef = useRef(onBlobReady);
  const onFileSizeRef = useRef(onFileSize);

  useEffect(() => {
    onBlobReadyRef.current = onBlobReady;
    onFileSizeRef.current = onFileSize;
  }, [onBlobReady, onFileSize]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    const load = async () => {
      setBlobUrl(null);
      setError('');
      onBlobReadyRef.current?.(null);
      onFileSizeRef.current?.(null);
      if (!version?.has_source_file) return;

      try {
        setLoading(true);
        const blob = await vaultApi.fetchVersionFile(version.id);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setBlobUrl(url);
        onBlobReadyRef.current?.(url);
        onFileSizeRef.current?.(blob.size);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load file'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [version?.id, version?.has_source_file]);

  const shellClass = embedded
    ? `vault-document-viewer vault-document-viewer--embedded ${className}`
    : `flex min-h-[50vh] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-0)] ${className}`;

  if (!version) {
    return (
      <div className={`${shellClass} vault-document-viewer--empty`}>
        <p className="text-sm text-[var(--color-on-surface-variant)]">Select a version to preview</p>
      </div>
    );
  }

  if (!version.has_source_file) {
    return (
      <div className={`${shellClass} vault-document-viewer--empty`}>
        <p className="text-sm text-[var(--color-on-surface)]">{copy.noFileStored}</p>
        <p className="mt-2 text-xs text-[var(--color-on-surface-variant)]">{copy.reuploadHint}</p>
      </div>
    );
  }

  const filename = version.source_filename || `resume-v${version.version_number}`;
  const isPdf =
    version.content_type?.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

  return (
    <div className={shellClass}>
      {!embedded ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2">
          <span className="truncate text-xs text-[var(--cream-3)]">{filename}</span>
          {blobUrl ? (
            <a
              href={blobUrl}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[var(--teal-1)] hover:text-[var(--cream-0)]"
            >
              Download
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="vault-document-viewer__canvas">
        {loading ? (
          <div className="vault-document-viewer__state" aria-busy="true" aria-live="polite">
            <div className="app-shimmer h-[min(70vh,720px)] w-full max-w-3xl rounded-xl" aria-hidden />
            <span className="sr-only">Loading document</span>
          </div>
        ) : error ? (
          <div className="vault-document-viewer__state vault-document-viewer__state--error">{error}</div>
        ) : isPdf && blobUrl ? (
          <iframe title={filename} src={blobUrl} className="vault-document-viewer__frame" />
        ) : blobUrl ? (
          <div className="vault-document-viewer__state">
            <p className="text-sm text-[var(--color-on-surface)]">Preview not available for this file type</p>
            <a href={blobUrl} download={filename} className="vault-version-detail__download-btn mt-3">
              Download original
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
