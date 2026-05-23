import type { InterviewHistoryItem } from 'shared/services/api';

export type ParsedFeedback = {
  text: string;
  generatedAt: string | null;
};

export function getInterviewId(interview: InterviewHistoryItem): string {
  return interview.id || interview.session_id || '';
}

export function getInterviewStartedAt(interview: InterviewHistoryItem): string | undefined {
  return (interview.started_at || interview.created_at || interview.completed_at) as string | undefined;
}

export function formatInterviewTitle(interview: InterviewHistoryItem): string {
  const typeLabel = String(interview.interview_type || 'interview').replace(/_/g, ' ').toUpperCase();
  const role = interview.target_role || interview.custom_role;
  const company = interview.target_company;

  if (role && company) return `${typeLabel} · ${role} @ ${company}`;
  if (role) return `${typeLabel} · ${role}`;
  return typeLabel;
}

export function parseFeedback(interview: InterviewHistoryItem): ParsedFeedback {
  const raw = interview.feedback ?? interview.final_feedback;
  if (typeof raw === 'string') {
    return { text: raw, generatedAt: null };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { feedback?: unknown; text?: unknown; generated_at?: string; generatedAt?: string };
    const text = String(obj.feedback || obj.text || '');
    return {
      text,
      generatedAt: obj.generated_at || obj.generatedAt || null,
    };
  }
  return { text: '', generatedAt: null };
}

export function normalizeHistoryResponse(data: {
  history?: InterviewHistoryItem[];
  interviews?: InterviewHistoryItem[];
}): InterviewHistoryItem[] {
  if (Array.isArray(data.history)) return data.history;
  if (Array.isArray(data.interviews)) return data.interviews;
  return [];
}
