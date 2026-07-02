import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';

import type { RankedAction } from '../../types/applicationFitTypes';
import { practiceInterviewHref } from '../../types/applicationFitTypes';

type ActionCardProps = {
  action: RankedAction;
  snapshotId: string;
  targetRole: string;
};

const PRIORITY_SURFACE: Record<string, string> = {
  CRITICAL: 'application-fit-action-card application-fit-action-card--critical',
  HIGH: 'application-fit-action-card application-fit-action-card--high',
  MEDIUM: 'application-fit-action-card',
  LOW: 'application-fit-action-card',
};

export function ActionCard({ action, snapshotId, targetRole }: ActionCardProps) {
  const surface = PRIORITY_SURFACE[action.priority] ?? PRIORITY_SURFACE.MEDIUM;

  return (
    <div className={surface}>
      <div className="application-fit-action-card__meta">
        <span className="application-fit-status-pill application-fit-status-pill--neutral">{action.priority}</span>
        {action.estimated_impact ? (
          <span className="application-fit-action-card__impact">{action.estimated_impact}</span>
        ) : null}
      </div>

      <h4 className="type-body-lg mt-2.5 leading-snug text-[var(--color-on-surface)]">{action.label}</h4>

      {action.detail ? (
        <p className="type-body-md mt-1.5 leading-relaxed text-[var(--color-on-surface-variant)]">{action.detail}</p>
      ) : null}

      {action.vpm_evidence_available ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded px-2 py-1 type-label-sm text-[var(--color-on-surface-variant)] bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)]">
          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--color-secondary)]" aria-hidden />
          Verified in Practice
        </div>
      ) : null}

      <div className="application-fit-action-card__footer-divider" aria-hidden />

      <div className="application-fit-action-card__footer">
        <span className="type-label-md text-[var(--color-on-surface-variant)]">
          {action.action_type === 'practice'
            ? 'Practice'
            : action.action_type === 'resume_edit'
              ? 'Resume edit'
              : 'Guidance'}
        </span>
        {action.action_type === 'resume_edit' ? (
          <Link to="/resume-vault" className="btn-ghost shrink-0 px-3 py-1.5 type-label-sm">
            Edit now
          </Link>
        ) : null}
        {action.action_type === 'practice' ? (
          <Link
            to={practiceInterviewHref(snapshotId, targetRole)}
            className="btn-primary shrink-0 px-3 py-1.5 type-label-sm"
          >
            Start mock
          </Link>
        ) : null}
      </div>
    </div>
  );
}
