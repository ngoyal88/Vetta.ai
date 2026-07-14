import { Loader2, Trash2, FileText, Upload } from 'lucide-react';

import { JdUploadOverlay } from 'shared/components/JdUploadOverlay';

import { JD_MAX_CHARS } from '../../types/applicationFitTypes';

type JobDescriptionPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onUploadClick: () => void;
  uploading?: boolean;
  canAnalyze: boolean;
  onAnalyze: () => void;
};

export function JobDescriptionPanel({
  value,
  onChange,
  onClear,
  onUploadClick,
  uploading = false,
  canAnalyze,
  onAnalyze,
}: JobDescriptionPanelProps) {
  const controlsDisabled = uploading;

  return (
    <div className="glass-panel flex h-full min-h-[420px] flex-col rounded-2xl p-5 md:p-6 lg:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <h2 className="type-label-md text-[var(--color-on-surface)]">Job description</h2>
        </div>
        {uploading ? (
          <span className="type-label-sm inline-flex items-center gap-1.5 text-[var(--color-primary)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Uploading…
          </span>
        ) : null}
      </div>
      <div className="application-fit-panel-divider" aria-hidden />

      <div
        className="role-targeted-jd-wrap application-fit-jd-wrap mt-4 min-h-0 flex-1"
        aria-busy={uploading}
      >
        <textarea
          id="jd-input"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, JD_MAX_CHARS))}
          placeholder="Paste or upload the full job description..."
          className="role-targeted-jd-textarea textarea-scroll application-fit-jd-textarea"
          aria-describedby="jd-char-count"
          disabled={controlsDisabled}
          readOnly={controlsDisabled}
        />
        <JdUploadOverlay uploading={uploading} />
        <div
          id="jd-char-count"
          className="pointer-events-none absolute bottom-3 left-3 z-[1] rounded-md bg-[var(--color-surface-container-high)] px-2 py-1 font-mono type-label-sm text-[var(--color-on-surface-variant)]"
        >
          {value.length} / {JD_MAX_CHARS.toLocaleString()}
        </div>
        <div className="absolute bottom-3 right-3 z-[1] flex gap-1.5">
          <button
            type="button"
            onClick={onClear}
            disabled={controlsDisabled || !value}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Clear job description"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onUploadClick}
            disabled={controlsDisabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-70"
            aria-label={uploading ? 'Uploading job description' : 'Upload job description file'}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={!canAnalyze || uploading}
          onClick={onAnalyze}
          className="btn-primary px-8 py-3 shadow-luminous disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyze Fit
        </button>
      </div>
    </div>
  );
}
