import { describe, expect, it } from 'vitest';

import { computeSummary } from '../interviewAnalytics';
import type { InterviewHistoryItem } from 'shared/services/api';

describe('computeSummary', () => {
  it('returns zeros for empty history', () => {
    const summary = computeSummary([]);
    expect(summary.totalSessions).toBe(0);
    expect(summary.avgOverallScore).toBeNull();
    expect(summary.passRate).toBeNull();
  });

  it('computes averages and breakdowns', () => {
    const items: InterviewHistoryItem[] = [
      {
        interview_type: 'role_targeted',
        difficulty: 'medium',
        status: 'completed',
        target_role: 'Backend Engineer',
        started_at: new Date().toISOString(),
        scores: { overall: 7 },
      },
      {
        interview_type: 'dsa',
        difficulty: 'hard',
        status: 'ended_early',
        custom_role: 'Backend Engineer',
        started_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        scores: { overall: 5 },
      },
    ];

    const summary = computeSummary(items);
    expect(summary.totalSessions).toBe(2);
    expect(summary.completedSessions).toBe(2);
    expect(summary.avgOverallScore).toBe(6);
    expect(summary.passRate).toBe(50);
    expect(summary.byInterviewType.role_targeted).toBe(1);
    expect(summary.byInterviewType.dsa).toBe(1);
    expect(summary.topRoles[0]?.role).toBe('Backend Engineer');
    expect(summary.scoreTrend.length).toBe(2);
  });

  it('keeps deterministic ordering for equal timestamps and ignores invalid dates', () => {
    const now = new Date().toISOString();
    const items: InterviewHistoryItem[] = [
      {
        interview_type: 'role_targeted',
        difficulty: 'medium',
        started_at: now,
        scores: { overall: 7 },
      },
      {
        interview_type: 'role_targeted',
        difficulty: 'medium',
        started_at: now,
        scores: { overall: 6 },
      },
      {
        interview_type: 'role_targeted',
        difficulty: 'medium',
        started_at: 'invalid-date',
        scores: { overall: 9 },
      },
    ];

    const summary = computeSummary(items);
    expect(summary.scoreTrend.length).toBe(2);
    expect(summary.scoreTrend[0]?.score).toBe(7);
    expect(summary.scoreTrend[1]?.score).toBe(6);
  });
});
