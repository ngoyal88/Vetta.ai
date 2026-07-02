import { Trash2, FileText } from 'lucide-react';

import { JD_MAX_CHARS } from '../../types/applicationFitTypes';

type JobDescriptionPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  canAnalyze: boolean;
  onAnalyze: () => void;
};

export function JobDescriptionPanel({
  value,
  onChange,
  onClear,
  canAnalyze,
  onAnalyze,
}: JobDescriptionPanelProps) {
  return (
    <div className="glass-panel flex h-full min-h-[420px] flex-col rounded-2xl p-5 md:p-6 lg:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
          <h2 className="type-label-md text-[var(--color-on-surface)]">Job description</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!value}
          className="type-label-sm inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-error)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Clear
        </button>
      </div>
      <div className="application-fit-panel-divider" aria-hidden />

      <div className="role-targeted-jd-wrap application-fit-jd-wrap mt-4 min-h-0 flex-1">
        <textarea
          id="jd-input"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, JD_MAX_CHARS))}
          placeholder="Paste the full job description here..."
          className="role-targeted-jd-textarea textarea-scroll"
          aria-describedby="jd-char-count"
        />
        <div
          id="jd-char-count"
          className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-[var(--color-surface-container-high)] px-2 py-1 font-mono type-label-sm text-[var(--color-on-surface-variant)]"
        >
          {value.length} / {JD_MAX_CHARS.toLocaleString()}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={!canAnalyze}
          onClick={onAnalyze}
          className="btn-primary px-8 py-3 shadow-luminous disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyze Fit
        </button>
      </div>
    </div>
  );
}
