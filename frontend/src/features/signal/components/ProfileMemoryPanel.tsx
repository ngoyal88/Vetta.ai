import React from 'react';

import type { ProfileClaim, ProfileMemorySummaryV1 } from 'shared/services/api';
import type { ProfileMemoryState } from '../hooks/useSignalIntelligence';

type ProfileMemoryPanelProps = {
  memory: ProfileMemoryState;
};

const BUCKETS = ['technical', 'experience', 'behavioral', 'gaps'] as const;
type Bucket = (typeof BUCKETS)[number];
type MemoryEntry = ProfileMemorySummaryV1[Bucket][number];

export function ProfileMemoryPanel({ memory }: ProfileMemoryPanelProps) {
  if (!memory) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
        <h2 className="text-lg font-semibold text-[var(--cream-0)]">Verified profile memory</h2>
        <p className="text-sm text-[var(--cream-3)]">Loading profile memory...</p>
      </section>
    );
  }

  const { summary, timeline } = memory;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <h2 className="text-lg font-semibold text-[var(--cream-0)]">Verified profile memory</h2>
      <p className="mt-2 text-xs text-[var(--cream-4)]">
        schema {summary.schema_version || 'vpm-1'} · accepted {summary.accepted_count || 0} · last refresh:{' '}
        {summary.last_refresh || 'n/a'}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {BUCKETS.map((kind) => {
          const entries: MemoryEntry[] = summary[kind] || [];
          return (
            <div key={kind} className="rounded border border-[var(--border)] p-2">
              <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">
                {kind === 'gaps' ? 'practice gaps' : kind}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-[var(--cream-2)]">
                {entries.slice(0, 6).map((entry) => (
                  <li key={`${entry.claim_text}-${entry.updated_at}`}>{entry.claim_text}</li>
                ))}
                {entries.length === 0 ? <li className="text-[var(--cream-4)]">None</li> : null}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded border border-[var(--border)] p-2">
        <p className="text-xs uppercase tracking-wider text-[var(--cream-4)]">Timeline</p>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {timeline.map((entry: ProfileClaim) => (
            <div
              key={entry.id}
              className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--cream-2)]"
            >
              <span className="mr-2 text-[var(--cream-4)]">{entry.status}</span>
              <span className="mr-2">{entry.claim_category}</span>
              <span>{entry.claim_text}</span>
            </div>
          ))}
          {timeline.length === 0 ? (
            <p className="text-sm text-[var(--cream-3)]">No timeline entries yet</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
