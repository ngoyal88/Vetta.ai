import type { InterviewHistoryItem } from 'shared/services/api';

import {
  getModeLabel,
  type HistoryFilterTab,
} from 'features/interview/domain/modeContract';
import { getInterviewId, getInterviewStartedAt } from './interviewHistoryUtils';

export type { HistoryFilterTab } from 'features/interview/domain/modeContract';
export type HistoryDateRange = '7d' | '14d' | '30d' | 'all';

export type ScoreVerdict = {
  percent: number | null;
  label: string;
  metricLabel: string;
  ringClass: string;
  labelClass: string;
};

export function formatHistoryDateShort(iso?: string): string {
  if (!iso) return 'DATE UNKNOWN';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'DATE UNKNOWN';
  return parsed
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

export function formatHistoryTimeRange(iso?: string, durationMinutes?: number): string {
  if (!iso) return '—';
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return '—';
  const startLabel = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0) return startLabel;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const endLabel = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${startLabel} - ${endLabel}`;
}

export function getSessionCardTitle(interview: InterviewHistoryItem): string {
  const role = interview.target_role || interview.custom_role;
  if (role) return String(role);
  const type = String(interview.interview_type || 'interview').replace(/_/g, ' ');
  return type.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getSessionCardSubtitle(interview: InterviewHistoryItem): string {
  const type = String(interview.interview_type || 'interview');
  const modeLabel = getModeLabel(type);
  const company = interview.target_company ? String(interview.target_company) : null;
  const focus = interview.interview_focus
    ? String(interview.interview_focus).replace(/_/g, ' ')
    : null;
  if (company) return `${company} · ${modeLabel}`;
  if (focus) return `${focus} · ${modeLabel}`;
  return `General Tech · ${modeLabel}`;
}

export function getDetailPanelTitle(interview: InterviewHistoryItem): string {
  const company = interview.target_company ? String(interview.target_company) : null;
  const role = interview.target_role || interview.custom_role;
  if (company && role) return `${company} ${getSessionCardTitle(interview)} Interview`;
  return `${getSessionCardTitle(interview)} Interview`;
}

export function formatSessionIdLabel(interview: InterviewHistoryItem): string {
  const raw = getInterviewId(interview);
  if (!raw) return 'ID: —';
  const tail = raw.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0000';
  return `ID: SES-${tail}`;
}

export function getScoreVerdict(overall?: number | null): ScoreVerdict {
  if (overall == null || Number.isNaN(Number(overall))) {
    return {
      percent: null,
      label: 'PENDING',
      metricLabel: 'Signal',
      ringClass: 'text-[var(--color-outline)]',
      labelClass: 'text-[var(--color-on-surface-variant)]',
    };
  }
  const score = Number(overall);
  const percent = Math.round((Math.min(10, Math.max(0, score)) / 10) * 100);
  if (score >= 8) {
    return {
      percent,
      label: 'STRONG HIRE',
      metricLabel: 'Signal',
      ringClass: 'text-[var(--color-tertiary)]',
      labelClass: 'text-[var(--color-tertiary)]',
    };
  }
  if (score >= 6) {
    return {
      percent,
      label: 'NEEDS REFINEMENT',
      metricLabel: 'Clarity',
      ringClass: 'text-[var(--color-secondary)]',
      labelClass: 'text-[var(--color-secondary)]',
    };
  }
  return {
    percent,
    label: 'NEEDS WORK',
    metricLabel: 'Signal',
    ringClass: 'text-[var(--color-error)]',
    labelClass: 'text-[var(--color-error)]',
  };
}

export function filterHistoryItems(
  items: InterviewHistoryItem[],
  tab: HistoryFilterTab,
  dateRange: HistoryDateRange,
): InterviewHistoryItem[] {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    const type = String(item.interview_type || '');
    if (tab !== 'all' && type !== tab) return false;

    if (dateRange !== 'all') {
      const started = getInterviewStartedAt(item);
      if (!started) return true;
      const ts = new Date(started).getTime();
      const rangeMs =
        dateRange === '7d' ? sevenDaysMs : dateRange === '14d' ? fourteenDaysMs : thirtyDaysMs;
      if (!Number.isNaN(ts) && now - ts > rangeMs) return false;
    }
    return true;
  });
}

export function isRoleTargetedSession(interview: InterviewHistoryItem): boolean {
  return interview.interview_type === 'role_targeted';
}

export function truncateHighlightTitle(text: string, maxLen = 32): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trimEnd()}…`;
}
