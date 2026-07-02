import { History } from 'lucide-react';

import type { HistoryEntry } from '../../types/applicationFitTypes';
import { FitHistoryRow } from './FitHistoryRow';

type FitHistoryTableProps = {
  history: HistoryEntry[];
  loading: boolean;
  error: string | null;
};

export function FitHistoryTable({ history, loading, error }: FitHistoryTableProps) {
  if (loading) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center application-fit-skeleton">
        Loading history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center text-[var(--color-error)]">{error}</div>
    );
  }

  if (!history.length) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center">
        <p className="type-body-lg text-[var(--color-on-surface-variant)]">No runs yet for this target.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--color-on-surface)_8%,transparent)] p-4">
        <History className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
        <h3 className="type-headline-md text-[var(--color-on-surface)]">Version timeline</h3>
      </div>
      <div className="type-label-sm hidden grid-cols-[1.2fr_1fr_1.5fr_1fr_auto] gap-4 border-b border-[color-mix(in_srgb,var(--color-on-surface)_8%,transparent)] px-6 py-3 uppercase tracking-widest text-[var(--color-on-surface-variant)] md:grid">
        <span>Snapshot Date</span>
        <span>Fit Score</span>
        <span>Predicted Blocker</span>
        <span>Score Delta</span>
        <span className="text-right">Actions</span>
      </div>
      {history.map((entry) => (
        <FitHistoryRow
          key={entry.snapshot_id}
          entry={entry}
          viewHref={`/application-fit?snapshot_id=${encodeURIComponent(entry.snapshot_id)}`}
        />
      ))}
    </div>
  );
}
