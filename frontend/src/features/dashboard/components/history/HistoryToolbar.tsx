import React, { memo } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

import type { HistoryDateRange, HistoryFilterTab } from '../../utils/historyPresentationUtils';

const FILTER_TABS: { id: HistoryFilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'role_targeted', label: 'Role Targeted' },
  { id: 'resume', label: 'Resume Deep Dive' },
];

const DATE_RANGE_OPTIONS: { id: HistoryDateRange; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '14d', label: 'Last 14 days' },
  { id: '30d', label: 'Last 30 days' },
];

type HistoryToolbarProps = {
  filterTab: HistoryFilterTab;
  dateRange: HistoryDateRange;
  loading: boolean;
  onFilterTabChange: (tab: HistoryFilterTab) => void;
  onDateRangeChange: (range: HistoryDateRange) => void;
  onRefresh: () => void;
};

function HistoryToolbarComponent({
  filterTab,
  dateRange,
  loading,
  onFilterTabChange,
  onDateRangeChange,
  onRefresh,
}: HistoryToolbarProps) {
  return (
    <div className="history-toolbar">
      <label className="history-toolbar__control">
        <span className="text-[var(--color-on-surface-variant)]">Mode</span>
        <select
          value={filterTab}
          onChange={(event) => onFilterTabChange(event.target.value as HistoryFilterTab)}
          className="min-w-[10.5rem] bg-transparent text-sm text-[var(--color-on-surface)] outline-none"
          aria-label="Filter by interview mode"
        >
          {FILTER_TABS.map((tab) => (
            <option key={tab.id} value={tab.id} className="bg-[var(--color-surface)] text-[var(--color-on-surface)]">
              {tab.label}
            </option>
          ))}
        </select>
      </label>

      <label className="history-toolbar__control">
        <Calendar className="h-4 w-4 text-[var(--color-on-surface-variant)]" aria-hidden />
        <select
          value={dateRange}
          onChange={(event) => onDateRangeChange(event.target.value as HistoryDateRange)}
          className="min-w-[9.5rem] bg-transparent text-sm text-[var(--color-on-surface)] outline-none"
          aria-label="Filter by date range"
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} className="bg-[var(--color-surface)] text-[var(--color-on-surface)]">
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="history-toolbar__control"
        aria-label="Refresh sessions"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  );
}

export const HistoryToolbar = memo(HistoryToolbarComponent);
