import React, { memo } from 'react';
import { motion, type MotionProps } from 'framer-motion';
import { CheckCircle2, ChevronRight, FileText, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { ResumeProfile } from 'features/vault/types';
import { SECTION_ICON_CLASS } from '../constants/focusOptions';

type ResumeContextSectionProps = {
  motionProps: MotionProps;
  loadingResume: boolean;
  parsedResume: ResumeProfile | null;
  activeResumeName: string | null;
};

function ResumeContextSectionComponent({
  motionProps,
  loadingResume,
  parsedResume,
  activeResumeName,
}: ResumeContextSectionProps) {
  return (
    <motion.section
      {...motionProps}
      className="glass-panel rounded-2xl p-5 md:p-6"
      aria-labelledby="resume-context-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`${SECTION_ICON_CLASS} border-[var(--color-tertiary)]/25 bg-[var(--color-tertiary)]/10 text-[var(--color-tertiary)]`}
          >
            <FileText className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 id="resume-context-heading" className="type-headline-md text-[var(--color-on-surface)]">
              Resume context
            </h2>
            <p className="type-label-sm mt-1 text-[var(--color-on-surface-variant)]">
              Optional but recommended — pairs with your JD for sharper probes.
            </p>
          </div>
        </div>
        {!loadingResume && parsedResume ? (
          <span className="dashboard-chip">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Active in Vault
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/60 p-4">
        {loadingResume ? (
          <p className="type-body-md text-[var(--color-on-surface-variant)]">Checking Resume Vault…</p>
        ) : parsedResume ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="type-body-md font-semibold text-[var(--color-on-surface)]">
                {activeResumeName ?? 'Unnamed profile'}
              </p>
              <p className="type-label-sm mt-1 text-[var(--color-on-surface-variant)]">
                {parsedResume.work_experience?.length ?? 0} roles · {parsedResume.projects?.length ?? 0}{' '}
                projects
              </p>
            </div>
            <Link
              to="/resume-vault"
              className="inline-flex items-center gap-1.5 type-label-sm text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-fixed)]"
            >
              Manage
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="type-body-md text-[var(--color-warning)]">
              No active resume. Add a job description below or open Vault first.
            </p>
            <Link to="/resume-vault" className="btn-ghost inline-flex h-9 items-center gap-2 px-3 text-xs">
              <FolderOpen className="h-4 w-4" aria-hidden />
              Open Vault
            </Link>
          </div>
        )}
      </div>
    </motion.section>
  );
}

export const ResumeContextSection = memo(ResumeContextSectionComponent);
