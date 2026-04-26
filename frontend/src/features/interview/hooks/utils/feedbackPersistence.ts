import { feedbackKey } from "./sessionKeys";

type FeedbackPayload = {
  feedback?: string;
  full?: unknown;
  duration_minutes?: number;
  questions_answered?: number;
  code_problems_attempted?: number;
};

export const persistFeedback = (sessionId: string, payload: FeedbackPayload) => {
  if (!sessionId) return false;
  try {
    sessionStorage.setItem(feedbackKey(sessionId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

export const loadFeedback = (sessionId: string) => {
  if (!sessionId) return null;
  try {
    const raw = sessionStorage.getItem(feedbackKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as FeedbackPayload;
  } catch {
    return null;
  }
};
