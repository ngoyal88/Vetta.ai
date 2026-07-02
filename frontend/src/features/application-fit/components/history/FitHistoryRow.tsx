import { Link } from 'react-router-dom';
import { ArrowUp, History } from 'lucide-react';

import type { HistoryEntry } from '../../types/applicationFitTypes';
import { FitScoreGauge } from '../report/FitScoreGauge';

type FitHistoryRowProps = {
  entry: HistoryEntry;
  viewHref: string;
};

export function FitHistoryRow({ entry, viewHref }: FitHistoryRowProps) {
  const date = new Date(entry.computed_at);
  const dateLabel = Number.isNaN(date.getTime())
    ? entry.computed_at
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="group grid grid-cols-1 items-center gap-4 border-b border-[color-mix(in_srgb,var(--color-on-surface)_6%,transparent)] px-6 py-5 transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--color-on-surface)_4%,transparent)] md:grid-cols-[1.2fr_1fr_1.5fr_1fr_auto]">
      <div>
        <span className="type-body-md text-[var(--color-on-surface)]">{dateLabel}</span>
        <span className="block font-mono text-xs text-[var(--color-on-surface-variant)] opacity-70">
          {entry.computed_at}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <FitScoreGauge score={entry.application_fit_score} size="sm" />
        <span className="font-mono text-sm">{entry.application_fit_score}%</span>
      </div>
      <div>
        <span
          className={`type-label-sm inline-flex items-center gap-1.5 rounded-md px-3 py-1 ${
            entry.bottleneck_stage === 'none'
              ? 'bg-[color-mix(in_srgb,var(--color-tertiary)_12%,transparent)] text-[var(--color-tertiary)]'
              : 'border border-[color-mix(in_srgb,var(--color-error)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-error-container)_12%,transparent)] text-[var(--color-error)]'
          }`}
        >
          {entry.bottleneck_label}
        </span>
      </div>
      <div>
        {entry.delta_vs_previous != null ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[var(--color-tertiary)] font-mono text-sm border border-[var(--color-tertiary)]/20">
            <ArrowUp className="h-3.5 w-3.5" />
            {entry.delta_vs_previous > 0 ? '+' : ''}
            {entry.delta_vs_previous}%
          </span>
        ) : (
          <span className="font-mono text-sm text-[var(--color-on-surface-variant)] opacity-50">--</span>
        )}
      </div>
      <div className="flex justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <Link
          to={viewHref}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--color-surface-container-highest)] type-label-sm text-[var(--color-primary)]"
        >
          <History className="h-4 w-4" />
          View report
        </Link>
      </div>
    </div>
  );
}
