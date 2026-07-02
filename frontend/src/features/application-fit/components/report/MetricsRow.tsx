import { ArrowRight, CheckCircle2 } from 'lucide-react';

import type { ComputeResponse } from '../../types/applicationFitTypes';
import { FIT_BAND_LABELS } from '../../types/applicationFitTypes';
import { FitScoreGauge } from './FitScoreGauge';

type MetricsRowProps = {
  report: ComputeResponse;
};

export function MetricsRow({ report }: MetricsRowProps) {
  const matchPct = Math.round(report.funnel.ats.coverage_pct * 100);
  const showPrepared = report.prepared_fit_score != null && report.prepared_fit_delta > 0;
  const gridClass = showPrepared
    ? 'application-fit-metrics-grid application-fit-metrics-grid--three'
    : 'application-fit-metrics-grid application-fit-metrics-grid--two';

  return (
    <section className={gridClass}>
      <div className="glass-panel application-fit-panel application-fit-metric-card application-fit-metric-card--gauge">
        <h3 className="application-fit-metric-card__head type-label-md text-[var(--color-on-surface-variant)]">
          Application Fit
        </h3>
        <div className="application-fit-metric-card__body items-center gap-3">
          <FitScoreGauge score={report.application_fit_score} />
          <div className="application-fit-band-chip">
            <span className="type-label-sm text-[var(--color-secondary)]">
              {FIT_BAND_LABELS[report.fit_band]}
            </span>
          </div>
        </div>
      </div>

      <div className="glass-panel application-fit-panel application-fit-metric-card">
        <h3 className="application-fit-metric-card__head type-label-md text-[var(--color-on-surface-variant)] mb-3">
          Requirement Match
        </h3>
        <div className="application-fit-metric-card__body">
          <div className="mb-4 flex items-center gap-2">
            <span className="type-display-lg tabular-nums leading-none text-[var(--color-primary)]">
              {matchPct}%
            </span>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-secondary)]" aria-hidden />
          </div>
          <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-container-highest)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] shadow-luminous transition-[width] duration-300"
              style={{ width: `${matchPct}%` }}
            />
          </div>
        </div>
      </div>

      {showPrepared ? (
        <div className="glass-panel application-fit-panel application-fit-metric-card application-fit-metric-card--prepared relative">
          <div className="absolute right-3 top-3 hidden type-label-sm text-[var(--color-primary)] md:block">
            VPM Active
          </div>
          <h3 className="application-fit-metric-card__head type-label-md mb-3 text-[var(--color-on-primary-container)]">
            With Verified Additions
          </h3>
          <div className="application-fit-metric-card__body">
            <div className="flex items-center gap-3">
              <span className="type-headline-lg tabular-nums text-[var(--color-tertiary-container)]">
                +{report.prepared_fit_delta}
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[var(--color-on-surface-variant)]" aria-hidden />
              <span className="type-display-lg tabular-nums leading-none text-[var(--color-primary)]">
                {report.prepared_fit_score}%
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
