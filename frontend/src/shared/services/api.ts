import { auth } from "firebaseConfig";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type AuthHeaders = Record<string, string>;

export type StartInterviewResponse = {
  session_id: string;
  [key: string]: unknown;
};

export type StartInterviewTargetContext = {
  targetCompany?: string | null;
  targetRole?: string | null;
  jobDescription?: string | null;
  interviewFocus?: string | null;
};

export type SubmitCodeResponse = {
  passed?: boolean;
  tests_passed?: number;
  total_tests?: number;
  result?: {
    error_message?: string | null;
    error?: string | null;
    test_results?: Array<{
      passed?: boolean;
      hidden?: boolean;
      status?: string;
      output?: string;
      error?: string;
      error_message?: string;
      error_type?: string;
      time?: number;
    }>;
  };
  [key: string]: unknown;
};

export type TranscriptLine = {
  speaker: string;
  text: string;
  timestamp?: string;
};

export type ReplayHighlight = {
  question: string;
  answer: string;
  source?: 'llm';
  confidence?: number;
};

export type InterviewHistoryItem = {
  id?: string;
  session_id?: string;
  started_at?: string;
  created_at?: string;
  completed_at?: string;
  status?: string;
  interview_type?: string;
  custom_role?: string;
  target_role?: string;
  target_company?: string;
  interview_focus?: string;
  difficulty?: string;
  duration_minutes?: number;
  questions_answered?: number;
  candidate_name?: string;
  years_experience?: number;
  scores?: {
    overall?: number;
    [key: string]: unknown;
  };
  feedback?: string | { feedback?: string; text?: string; generated_at?: string; generatedAt?: string } | null;
  final_feedback?: string | { feedback?: string; text?: string; generated_at?: string; generatedAt?: string } | null;
  live_transcription?: TranscriptLine[];
  replay_highlights?: ReplayHighlight[];
  [key: string]: unknown;
};

export type InterviewHistoryResponse = {
  history?: InterviewHistoryItem[];
  interviews?: InterviewHistoryItem[];
  [key: string]: unknown;
};

const getAuthHeaders = async (isForm = false): Promise<AuthHeaders> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  const base: AuthHeaders = { Authorization: `Bearer ${token}` };
  return isForm ? base : { "Content-Type": "application/json", ...base };
};

const startInterview = async (
  userId: string,
  interviewType: string,
  difficulty: string,
  resumeData?: unknown,
  customRole: string | null = null,
  candidateName: string | null = null,
  yearsExperience: number | null = null,
  targetContext: StartInterviewTargetContext = {},
): Promise<StartInterviewResponse> => {
  const response = await fetch(`${API_URL}/interview/start`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      user_id: userId,
      interview_type: interviewType,
      difficulty,
      custom_role: customRole,
      resume_data: resumeData,
      candidate_name: candidateName,
      years_experience: yearsExperience,
      target_company: targetContext.targetCompany,
      target_role: targetContext.targetRole ?? customRole,
      job_description: targetContext.jobDescription,
      interview_focus: targetContext.interviewFocus,
    }),
  });

  if (!response.ok) {
    let message = "Failed to start interview";
    try {
      const errorBody = await response.json();
      if (typeof errorBody?.detail === "string") message = errorBody.detail;
    } catch {
      // Keep the generic message if the server did not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<StartInterviewResponse>;
};

const submitCode = async (
  sessionId: string,
  questionId: string,
  language: string,
  code: string,
): Promise<SubmitCodeResponse> => {
  const response = await fetch(`${API_URL}/interview/submit-code`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      language,
      code,
    }),
  });

  if (!response.ok) throw new Error("Code execution failed");
  return response.json() as Promise<SubmitCodeResponse>;
};

const completeInterview = async (sessionId: string): Promise<Record<string, unknown>> => {
  const response = await fetch(`${API_URL}/interview/complete?session_id=${sessionId}`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error("Failed to complete interview");
  return response.json() as Promise<Record<string, unknown>>;
};

export type SessionDetailsResponse = {
  status?: string;
  completion_reason?: string;
  final_feedback?: {
    feedback?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const getSessionDetails = async (sessionId: string): Promise<SessionDetailsResponse> => {
  const response = await fetch(`${API_URL}/interview/session/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch session details");
  return response.json() as Promise<SessionDetailsResponse>;
};

const getInterviewHistory = async (limit = 20): Promise<InterviewHistoryResponse> => {
  const response = await fetch(`${API_URL}/interview/history?limit=${limit}`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error("Failed to fetch interview history");
  return response.json() as Promise<InterviewHistoryResponse>;
};

const deleteInterview = async (sessionId: string): Promise<Record<string, unknown>> => {
  const response = await fetch(`${API_URL}/interview/history/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error("Failed to delete interview");
  return response.json() as Promise<Record<string, unknown>>;
};

const deleteAccountData = async (): Promise<Record<string, unknown>> => {
  const response = await fetch(`${API_URL}/interview/account/purge`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to delete account data");
  return response.json() as Promise<Record<string, unknown>>;
};

export const api = {
  startInterview,
  submitCode,
  completeInterview,
  getSessionDetails,
  getInterviewHistory,
  deleteInterview,
  deleteAccountData,
};
