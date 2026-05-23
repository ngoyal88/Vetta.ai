import type { InterviewHistoryItem } from 'shared/services/api';
import { getInterviewStartedAt } from './interviewHistoryUtils';

export type AnalyticsSummary = {
  totalSessions: number;
  completedSessions: number;
  avgOverallScore: number | null;
  sessionsLast30Days: number;
  passRate: number | null;
  byInterviewType: Record<string, number>;
  byDifficulty: Record<string, number>;
  topRoles: Array<{ role: string; count: number }>;
  scoreTrend: Array<{ date: string; score: number; label: string }>;
};

const COMPLETED_STATUSES = new Set(['completed', 'ended_early']);

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function increment(map: Record<string, number>, key: string): void {
  const normalized = key.trim() || 'unknown';
  map[normalized] = (map[normalized] || 0) + 1;
}

export function computeSummary(items: InterviewHistoryItem[]): AnalyticsSummary {
  const byInterviewType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const roleCounts: Record<string, number> = {};

  let completedSessions = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let passCount = 0;
  let sessionsLast30Days = 0;

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const scored: Array<{ date: Date; score: number; label: string }> = [];

  for (const item of items) {
    const status = String(item.status || '').toLowerCase();
    if (COMPLETED_STATUSES.has(status)) completedSessions += 1;

    increment(byInterviewType, String(item.interview_type || 'unknown'));
    increment(byDifficulty, String(item.difficulty || 'unknown'));

    const role = String(item.target_role || item.custom_role || '').trim();
    if (role) increment(roleCounts, role);

    const startedAt = parseDate(getInterviewStartedAt(item));
    if (startedAt && now - startedAt.getTime() <= thirtyDaysMs) {
      sessionsLast30Days += 1;
    }

    const overall = item.scores?.overall;
    if (typeof overall === 'number' && !Number.isNaN(overall)) {
      scoreSum += overall;
      scoreCount += 1;
      if (overall >= 6) passCount += 1;
      if (startedAt) {
        scored.push({
          date: startedAt,
          score: overall,
          label: startedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        });
      }
    }
  }

  scored.sort((a, b) => a.date.getTime() - b.date.getTime());
  const scoreTrend = scored.slice(-10).map(({ date, score, label }) => ({
    date: date.toISOString(),
    score,
    label,
  }));

  const topRoles = Object.entries(roleCounts)
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalSessions: items.length,
    completedSessions,
    avgOverallScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
    sessionsLast30Days,
    passRate: scoreCount > 0 ? Math.round((passCount / scoreCount) * 100) : null,
    byInterviewType,
    byDifficulty,
    topRoles,
    scoreTrend,
  };
}
