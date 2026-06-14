import React from 'react';

import type { ProfileClaim } from 'shared/services/api';
import { ClaimRow } from './ClaimRow';

export type SectionFilter = 'profile' | 'gaps' | 'pending';

const SECTION_FILTERS: Array<{ id: SectionFilter; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'profile', label: 'Pending strengths' },
  { id: 'gaps', label: 'Pending gaps' },
];

type ClaimsInboxProps = {
  sectionFilter: SectionFilter;
  claims: ProfileClaim[];
  selected: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  actingId: string | null;
  bulkBusy: boolean;
  onSectionFilterChange: (section: SectionFilter) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onAccept: (item: ProfileClaim) => void;
  onReject: (item: ProfileClaim) => void;
  onBulkAccept: () => void;
  onBulkReject: () => void;
};

export function ClaimsInbox({
  sectionFilter,
  claims,
  selected,
  loading,
  error,
  actingId,
  bulkBusy,
  onSectionFilterChange,
  onToggleSelected,
  onAccept,
  onReject,
  onBulkAccept,
  onBulkReject,
}: ClaimsInboxProps) {
  // ponytail: O(n) over selected keys; fine until bulk inbox grows past ~100 rows
  const selectedCount = Object.keys(selected).filter((id) => selected[id]).length;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-[var(--cream-0)]">Verified claims inbox</h2>
        {SECTION_FILTERS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionFilterChange(section.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              sectionFilter === section.id
                ? 'border-[var(--teal-2)] text-[var(--cream-0)]'
                : 'border-[var(--border)] text-[var(--cream-3)]'
            }`}
          >
            {section.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!selectedCount || bulkBusy}
          onClick={onBulkAccept}
          className="ml-auto rounded border border-[var(--teal-2)] px-3 py-1 text-xs text-[var(--cream-0)] disabled:opacity-50"
        >
          Accept selected
        </button>
        <button
          type="button"
          disabled={!selectedCount || bulkBusy}
          onClick={onBulkReject}
          className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--cream-1)] disabled:opacity-50"
        >
          Reject selected
        </button>
      </div>

      {loading ? <p className="text-sm text-[var(--cream-3)]">Loading...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {!loading && !error && claims.length === 0 ? (
        <p className="text-sm text-[var(--cream-3)]">
          No claims in this view. Complete a mock interview to generate verified claims.
        </p>
      ) : null}

      <div className="space-y-2">
        {claims.map((item) => (
          <ClaimRow
            key={item.id}
            item={item}
            checked={Boolean(selected[item.id])}
            acting={actingId === item.id}
            onToggle={onToggleSelected}
            onAccept={onAccept}
            onReject={onReject}
          />
        ))}
      </div>
    </section>
  );
}
