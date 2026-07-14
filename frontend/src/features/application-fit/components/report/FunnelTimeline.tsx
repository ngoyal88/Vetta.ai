import { Filter, X, Check } from 'lucide-react';

import type { ComputeResponse, LayerVerdict } from '../../types/applicationFitTypes';
import { VERDICT_LABELS } from '../../types/applicationFitTypes';

type FunnelTimelineProps = {
  report: ComputeResponse;
};

type FunnelStep = {
  key: string;
  title: string;
  verdict: LayerVerdict;
  body: string;
  isPrepared: boolean;
};

function verdictClass(verdict: LayerVerdict): string {
  if (verdict === 'pass') return 'application-fit-verdict-badge application-fit-verdict-badge--pass';
  if (verdict === 'at_risk') return 'application-fit-verdict-badge application-fit-verdict-badge--at-risk';
  return 'application-fit-verdict-badge application-fit-verdict-badge--fail';
}

export function FunnelTimeline({ report }: FunnelTimelineProps) {
  const recruiterCoverage = Math.round((report.funnel.recruiter.signals?.coverage_pct ?? report.funnel.recruiter.score) * 100);
  const hmCoverage = Math.round(report.funnel.hm_application.score * 100);
  const baseSteps: FunnelStep[] = [
    {
      key: 'ats',
      title: 'ATS Filter',
      verdict: report.funnel.ats.verdict,
      body:
        report.funnel.ats.missing_keywords.length > 0
          ? `${Math.round(report.funnel.ats.coverage_pct * 100)}% coverage. Gaps: ${report.funnel.ats.missing_keywords.slice(0, 3).join(', ')}.`
          : `${Math.round(report.funnel.ats.coverage_pct * 100)}% coverage of ATS-stage requirements on your resume.`,
      isPrepared: false,
    },
    {
      key: 'recruiter',
      title: 'Recruiter Scan',
      verdict: report.funnel.recruiter.verdict,
      body: `${recruiterCoverage}% coverage of recruiter-stage requirements (experience, seniority, education).`,
      isPrepared: false,
    },
    {
      key: 'hm',
      title: 'HM Review',
      verdict: report.funnel.hm_application.verdict,
      body:
        report.funnel.hm_application.missing_skills.length > 0
          ? `${hmCoverage}% coverage. Still thin on: ${report.funnel.hm_application.missing_skills.slice(0, 3).join(', ')}.`
          : `${hmCoverage}% coverage of HM-stage requirements evidenced on your resume.`,
      isPrepared: false,
    },
  ];

  const allSteps: FunnelStep[] = report.funnel.hm_prepared
    ? [
        ...baseSteps,
        {
          key: 'prepared',
          title: 'Prepared depth (VPM)',
          verdict: 'pass',
          body: `With verified additions, HM depth improves to ${Math.round(report.funnel.hm_prepared.score * 100)}%.`,
          isPrepared: true,
        },
      ]
    : baseSteps;

  return (
    <section id="application-fit-funnel" className="glass-panel application-fit-panel h-full flex flex-col">
      <h3 className="application-fit-panel-title type-headline-md text-[var(--color-on-surface)] flex items-center gap-2">
        <Filter className="h-5 w-5 text-[var(--color-primary)] shrink-0" aria-hidden />
        Where you likely get screened
      </h3>

      <div className="application-fit-funnel flex-1">
        {allSteps.map((step, index) => {
          const isPass = step.verdict === 'pass';
          const isAtRisk = step.verdict === 'at_risk';
          const isLast = index === allSteps.length - 1;
          const { isPrepared } = step;

          const dotClass = isPrepared
            ? 'application-fit-funnel-dot application-fit-funnel-dot--prepared'
            : isPass
              ? 'application-fit-funnel-dot application-fit-funnel-dot--pass'
              : isAtRisk
                ? 'application-fit-funnel-dot application-fit-funnel-dot--at-risk'
                : 'application-fit-funnel-dot application-fit-funnel-dot--fail';

          const cardClass = isPrepared
            ? 'application-fit-funnel-card application-fit-funnel-card--prepared'
            : isPass || isAtRisk
              ? 'application-fit-funnel-card'
              : 'application-fit-funnel-card application-fit-funnel-card--fail';

          return (
            <div key={step.key} className="application-fit-funnel-step">
              <div className="application-fit-funnel-rail">
                <div className={dotClass}>
                  {isPrepared ? (
                    <Check className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
                  ) : isPass ? (
                    <div className="h-2 w-2 rounded-full bg-[var(--color-secondary)]" />
                  ) : isAtRisk ? (
                    <div className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-[var(--color-error)]" aria-hidden />
                  )}
                </div>
                {!isLast ? <div className="application-fit-funnel-connector" aria-hidden /> : null}
              </div>

              <div className={cardClass}>
                <div className="application-fit-funnel-card__head">
                  <h4
                    className={`type-body-lg leading-snug ${
                      isPass || isPrepared || isAtRisk
                        ? 'text-[var(--color-on-surface)]'
                        : 'text-[var(--color-error)]'
                    }`}
                  >
                    {step.title}
                  </h4>
                  {!isPrepared ? (
                    <span className={verdictClass(step.verdict)}>{VERDICT_LABELS[step.verdict]}</span>
                  ) : null}
                </div>
                <p className="type-body-md text-[var(--color-on-surface-variant)] leading-relaxed m-0">
                  {step.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
