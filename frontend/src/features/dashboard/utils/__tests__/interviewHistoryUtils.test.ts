import { describe, expect, it } from 'vitest';

import {
  formatInterviewTitle,
  normalizeHistoryResponse,
  parseFeedback,
} from '../interviewHistoryUtils';

describe('interviewHistoryUtils', () => {
  it('formats role-targeted titles with company', () => {
    const title = formatInterviewTitle({
      interview_type: 'role_targeted',
      target_role: 'Backend Engineer',
      target_company: 'Google',
    });
    expect(title).toBe('ROLE TARGETED · Backend Engineer @ Google');
  });

  it('parses object feedback', () => {
    const parsed = parseFeedback({
      final_feedback: { feedback: 'Strong performance', generated_at: '2026-01-01T00:00:00Z' },
    });
    expect(parsed.text).toBe('Strong performance');
    expect(parsed.generatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('normalizes history response keys', () => {
    expect(normalizeHistoryResponse({ history: [{ session_id: 'a' }] })).toHaveLength(1);
    expect(normalizeHistoryResponse({ interviews: [{ session_id: 'b' }] })).toHaveLength(1);
    expect(normalizeHistoryResponse({})).toEqual([]);
  });
});
