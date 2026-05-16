import React from 'react';

import type { VaultEntry, VaultScorecard, VaultVersion } from '../types';
import { formatCoverageCounts, formatTimestamp } from '../utils/vaultUtils';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cream-4)]">{label}</p>
      <div className="mt-1 text-sm text-[var(--cream-1)]">{value}</div>
    </div>
  );
}

interface VaultInsightsPanelProps {
  entry: VaultEntry | null;
  version: VaultVersion | null;
  scorecard: VaultScorecard | null | undefined;
  actions?: React.ReactNode;
}

export default function VaultInsightsPanel({ entry, version, scorecard, actions }: VaultInsightsPanelProps) {
  if (!entry || !version) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6 text-sm text-[var(--cream-3)]">
        Select a version to view insights.
      </div>
    );
  }

  const displayScore =
    entry.current_version_id === version.id
      ? scorecard?.score ?? version.score_at_version
      : version.latest_score ?? version.score_at_version;

  return (
    <div className="flex h-full flex-col">
      <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <DetailRow label="Score" value={displayScore ?? 'N/A'} />
        {scorecard?.summary_line ? <DetailRow label="Summary" value={scorecard.summary_line} /> : null}
        {scorecard ? (
          <DetailRow label="Coverage" value={formatCoverageCounts(scorecard.coverage_counts)} />
        ) : null}
        {scorecard?.ats_flags?.length ? (
          <DetailRow label="ATS flags" value={scorecard.ats_flags.join(', ')} />
        ) : null}
        {scorecard?.weak_areas?.length ? (
          <DetailRow label="Weak areas" value={scorecard.weak_areas.join(', ')} />
        ) : null}
        {scorecard?.suggestions?.length ? (
          <DetailRow
            label="Suggestions"
            value={
              <ul className="list-inside list-disc space-y-1">
                {scorecard.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            }
          />
        ) : null}
        {version.user_note ? <DetailRow label="Version note" value={version.user_note} /> : null}
        <DetailRow label="Created" value={formatTimestamp(version.created_at)} />
        {version.diff_summary ? <DetailRow label="Changes" value={version.diff_summary} /> : null}
      </div>
      {actions ? (
        <div className="mt-4 shrink-0 border-t border-[var(--border)] pt-4">{actions}</div>
      ) : null}
    </div>
  );
}
