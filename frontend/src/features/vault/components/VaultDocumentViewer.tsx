import React, { useEffect, useState } from 'react';

import { vaultApi } from '../services/vaultApi';
import type { VaultVersion } from '../types';
import { getErrorMessage } from '../utils/vaultUtils';

interface VaultDocumentViewerProps {
  version: VaultVersion | null;
  className?: string;
}

export default function VaultDocumentViewer({ version, className = '' }: VaultDocumentViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    const load = async () => {
      setBlobUrl(null);
      setError('');
      if (!version?.has_source_file) return;

      try {
        setLoading(true);
        const blob = await vaultApi.fetchVersionFile(version.id);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setBlobUrl(url);
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

  if (!version) {
    return (
      <div className={`flex min-h-[50vh] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-0)] ${className}`}>
        <p className="text-sm text-[var(--cream-3)]">Select a version to preview</p>
      </div>
    );
  }

  if (!version.has_source_file) {
    return (
      <div className={`flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-0)] p-6 text-center ${className}`}>
        <p className="text-sm text-[var(--cream-2)]">No file stored for this version</p>
        <p className="text-xs text-[var(--cream-4)]">Re-upload this version to enable file preview.</p>
      </div>
    );
  }

  const filename = version.source_filename || `resume-v${version.version_number}`;
  const isPdf =
    version.content_type?.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

  return (
    <div className={`flex min-h-[50vh] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-0)] ${className}`}>
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
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-[var(--cream-3)]">
            Loading document…
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center p-4 text-center text-sm text-[var(--red-1)]">
            {error}
          </div>
        ) : isPdf && blobUrl ? (
          <iframe title={filename} src={blobUrl} className="h-full min-h-[70vh] w-full border-0" />
        ) : blobUrl ? (
          <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-[var(--cream-2)]">Preview not available for this file type</p>
            <a
              href={blobUrl}
              download={filename}
              className="rounded-full bg-[var(--teal-2)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--cream-0)]"
            >
              Download original
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
