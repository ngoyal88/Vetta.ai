import React from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { FileText, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';

import { JdUploadOverlay } from 'shared/components/JdUploadOverlay';

import { SECTION_ICON_CLASS } from '../constants/focusOptions';

type JobDescriptionSectionProps = {
  motionProps: MotionProps;
  jobDescription: string;
  jdCharCount: number;
  onJobDescriptionChange: (value: string) => void;
  onClear: () => void;
  onUploadClick: () => void;
  uploading?: boolean;
  onExtractInsights?: () => void;
  canExtractInsights?: boolean;
};

export function JobDescriptionSection({
  motionProps,
  jobDescription,
  jdCharCount,
  onJobDescriptionChange,
  onClear,
  onUploadClick,
  uploading = false,
  onExtractInsights,
  canExtractInsights = false,
}: JobDescriptionSectionProps) {
  const controlsDisabled = uploading;

  return (
    <motion.section
      {...motionProps}
      className="glass-panel rounded-2xl p-5 md:p-6"
      aria-labelledby="jd-context-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`${SECTION_ICON_CLASS} border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]`}
          >
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <h2 id="jd-context-heading" className="type-headline-md text-[var(--color-on-surface)]">
            Job description
          </h2>
        </div>
        {uploading ? (
          <span className="type-label-sm inline-flex items-center gap-1.5 text-[var(--color-primary)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Uploading…
          </span>
        ) : (
          <button
            type="button"
            disabled={!canExtractInsights}
            onClick={onExtractInsights}
            title={canExtractInsights ? 'Analyze fit in Application Fit' : 'Enter a role and job description first'}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 type-label-sm text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Extract insights
          </button>
        )}
      </div>
      <p className="type-body-md mt-4 text-[var(--color-on-surface-variant)]">
        Paste the full JD. Questions, constraints, and behavioral probes will track these requirements.
      </p>
      <div className="role-targeted-jd-wrap relative mt-4" aria-busy={uploading}>
        <textarea
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="Paste the full job description here..."
          rows={7}
          className="role-targeted-jd-textarea textarea-scroll"
          aria-describedby="jd-char-count"
          disabled={controlsDisabled}
          readOnly={controlsDisabled}
        />
        <JdUploadOverlay uploading={uploading} />
        <div className="pointer-events-none absolute bottom-3 left-4 z-[1]">
          <span id="jd-char-count" className="type-label-sm text-[var(--color-outline)]">
            {jdCharCount > 0 ? `${jdCharCount.toLocaleString()} characters` : 'Optional'}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 z-[1] flex gap-1.5">
          <button
            type="button"
            onClick={onClear}
            disabled={controlsDisabled || !jobDescription}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Clear job description"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onUploadClick}
            disabled={controlsDisabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-70"
            aria-label={uploading ? 'Uploading job description' : 'Upload job description file'}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </motion.section>
  );
}
