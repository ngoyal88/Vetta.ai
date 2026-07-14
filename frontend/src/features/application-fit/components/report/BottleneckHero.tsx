import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { ComputeResponse, HeroVerdict, RankedAction } from '../../types/applicationFitTypes';
import { builderEditHrefFromReport, practiceInterviewHref } from '../../types/applicationFitTypes';

type BottleneckHeroProps = {
  report: ComputeResponse;
  targetRole: string;
};

const HERO_COPY: Record<
  HeroVerdict,
  {
    eyebrow: string;
    title: string;
    icon: typeof CheckCircle2;
    iconClassName: string;
    titleClassName: string;
    sectionClassName: string;
  }
> = {
  apply_now: {
    eyebrow: 'Decision',
    title: 'Apply now',
    icon: CheckCircle2,
    iconClassName: 'text-[var(--color-tertiary)]',
    titleClassName: 'text-[var(--color-tertiary)]',
    sectionClassName: 'application-fit-hero--clear',
  },
  fix_before_apply: {
    eyebrow: 'Recommended move',
    title: 'Fix before apply',
    icon: AlertTriangle,
    iconClassName: 'text-[var(--color-primary)]',
    titleClassName: 'text-[var(--color-on-surface)]',
    sectionClassName: 'application-fit-hero--blocker',
  },
  long_shot: {
    eyebrow: 'Recommended move',
    title: 'Long shot unless strategic',
    icon: AlertTriangle,
    iconClassName: 'text-[var(--color-error)]',
    titleClassName: 'text-[var(--color-error)]',
    sectionClassName: 'application-fit-hero--blocker',
  },
};

function heroActionHref(action: RankedAction | undefined, report: ComputeResponse, targetRole: string): string | null {
  if (!action) return null;
  if (action.action_type === 'resume_edit') {
    return builderEditHrefFromReport(report, report.snapshot_id) ?? '/resume-vault';
  }
  if (action.action_type === 'practice') return practiceInterviewHref(report.snapshot_id, targetRole);
  if (action.action_type === 'apply') return '#application-fit-funnel';
  return '#application-fit-actions';
}

export function BottleneckHero({ report, targetRole }: BottleneckHeroProps) {
  const hero = HERO_COPY[report.hero_verdict];
  const HeroIcon = hero.icon;
  const topAction = report.ranked_actions[0];
  const primaryHref = heroActionHref(topAction, report, targetRole);
  const secondaryLabel =
    report.bottleneck_stage === 'none' ? 'All three screens look clear' : `Primary bottleneck: ${report.bottleneck_label}`;

  return (
    <section className={`glass-panel application-fit-panel ${hero.sectionClassName}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <HeroIcon className={`h-7 w-7 shrink-0 ${hero.iconClassName}`} aria-hidden />
            <span className="type-label-md uppercase tracking-[0.14em] text-[var(--color-on-surface-variant)]">
              {hero.eyebrow}
            </span>
          </div>

          <h2 className={`type-headline-lg mb-2 leading-tight ${hero.titleClassName}`}>{hero.title}</h2>

          <p className="type-body-lg text-[var(--color-on-surface-variant)] leading-relaxed max-w-3xl">
            {report.hero_summary || report.why_this_score}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:max-w-sm lg:items-end">
          <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-surface-container-high)_55%,transparent)] px-4 py-3 lg:max-w-xs">
            <p className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
              Screening outlook
            </p>
            <p className="mt-1 type-body-md text-[var(--color-on-surface)]">{secondaryLabel}</p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {primaryHref ? (
              <Link
                to={primaryHref}
                className={topAction?.action_type === 'practice' ? 'btn-primary' : 'btn-secondary'}
              >
                {report.hero_primary_action_label ?? topAction?.label ?? 'Take the next step'}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            ) : null}
            <Link to="#application-fit-actions" className="btn-ghost">
              See guidance
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}