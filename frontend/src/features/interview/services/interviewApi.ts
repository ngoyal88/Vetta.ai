import {
  authenticatedFetch,
  authenticatedJson,
  getAuthHeaders,
  parseErrorDetail,
} from "shared/services/httpClient";

export type StartInterviewResponse = {
  session_id: string;
  [key: string]: unknown;
};

export type RoleTargetedStartConfig = {
  target_role: string;
  job_description?: string | null;
  interview_focus?: string;
  target_company?: string | null;
  jd_fit_snapshot_id?: string | null;
};

export type ResumeStartConfig = Record<string, never>;

export type PairProgrammingStartConfig = {
  track?: string;
  session_focus?: string | null;
};

export type StartInterviewConfig =
  | RoleTargetedStartConfig
  | ResumeStartConfig
  | PairProgrammingStartConfig;

export type StartInterviewParams = {
  interviewType: string;
  difficulty: string;
  candidateName?: string | null;
  yearsExperience?: number | null;
  resumeData?: unknown;
  config: StartInterviewConfig;
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
  source?: "llm";
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
  feedback?:
    | string
    | { feedback?: string; text?: string; generated_at?: string; generatedAt?: string }
    | null;
  final_feedback?:
    | string
    | { feedback?: string; text?: string; generated_at?: string; generatedAt?: string }
    | null;
  live_transcription?: TranscriptLine[];
  replay_highlights?: ReplayHighlight[];
  [key: string]: unknown;
};

export type InterviewHistoryResponse = {
  history?: InterviewHistoryItem[];
  interviews?: InterviewHistoryItem[];
  [key: string]: unknown;
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

const startInterview = async ({
  interviewType,
  difficulty,
  candidateName,
  yearsExperience,
  resumeData,
  config,
}: StartInterviewParams): Promise<StartInterviewResponse> =>
  authenticatedJson(
    "/interview/start",
    {
      method: "POST",
      body: JSON.stringify({
        interview_type: interviewType,
        difficulty,
        candidate_name: candidateName ?? undefined,
        years_experience: yearsExperience ?? undefined,
        resume_data: resumeData,
        config,
      }),
    },
    "Failed to start interview",
  );

const submitCode = async (
  sessionId: string,
  questionId: string,
  language: string,
  code: string,
): Promise<SubmitCodeResponse> => {
  const response = await authenticatedFetch("/interview/submit-code", {
    method: "POST",
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
  const response = await authenticatedFetch(
    `/interview/complete?session_id=${encodeURIComponent(sessionId)}`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error("Failed to complete interview");
  return response.json() as Promise<Record<string, unknown>>;
};

const getSessionDetails = async (sessionId: string): Promise<SessionDetailsResponse> =>
  authenticatedJson(
    `/interview/session/${encodeURIComponent(sessionId)}`,
    { method: "GET" },
    "Failed to fetch session details",
  );

const getInterviewHistory = async (limit = 20): Promise<InterviewHistoryResponse> =>
  authenticatedJson(
    `/interview/history?limit=${limit}`,
    { method: "GET" },
    "Failed to fetch interview history",
  );

const deleteInterview = async (sessionId: string): Promise<Record<string, unknown>> => {
  const response = await authenticatedFetch(
    `/interview/history/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Failed to delete interview");
  return response.json() as Promise<Record<string, unknown>>;
};

export const interviewApi = {
  startInterview,
  submitCode,
  completeInterview,
  getSessionDetails,
  getInterviewHistory,
  deleteInterview,
};

/** @deprecated import from features/interview/services/interviewApi */
export { getAuthHeaders, parseErrorDetail };
