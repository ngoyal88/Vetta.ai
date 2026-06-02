import React, { memo } from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { FileText, Sparkles, Trash2, Upload } from 'lucide-react';

import { SECTION_ICON_CLASS } from '../constants/focusOptions';

type JobDescriptionSectionProps = {
  motionProps: MotionProps;
  jobDescription: string;
  jdCharCount: number;
  onJobDescriptionChange: (value: string) => void;
  onClear: () => void;
  onUploadClick: () => void;
};

function JobDescriptionSectionComponent({
  motionProps,
  jobDescription,
  jdCharCount,
  onJobDescriptionChange,
  onClear,
  onUploadClick,
}: JobDescriptionSectionProps) {
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
        <button
          type="button"
          disabled
          title="Insight extraction is coming soon"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 type-label-sm text-[var(--color-outline)] opacity-70"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Extract insights
          <span className="dashboard-pill !py-0 !text-[10px]">Soon</span>
        </button>
      </div>
      <p className="type-body-md mt-4 text-[var(--color-on-surface-variant)]">
        Paste the full JD. Questions, constraints, and behavioral probes will track these requirements.
      </p>
      <div className="role-targeted-jd-wrap mt-4">
        <textarea
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="Paste the full job description here..."
          rows={7}
          className="role-targeted-jd-textarea textarea-scroll"
          aria-describedby="jd-char-count"
        />
        <div className="pointer-events-none absolute bottom-3 left-4">
          <span id="jd-char-count" className="type-label-sm text-[var(--color-outline)]">
            {jdCharCount > 0 ? `${jdCharCount.toLocaleString()} characters` : 'Optional'}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <button
            type="button"
            onClick={onClear}
            disabled={!jobDescription}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Clear job description"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
            aria-label="Upload job description file"
          >
            <Upload className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.section>
  );
}

export const JobDescriptionSection = memo(JobDescriptionSectionComponent);
