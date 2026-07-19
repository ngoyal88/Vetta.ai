import { authenticatedJson } from "shared/services/httpClient";

export type ReadinessRequest = {
  target_role: string;
  job_description?: string;
  resume_id?: string;
  version_id?: string;
};

export type ReadinessResponse = {
  target_role: string;
  jd_hash: string;
  overall_score: number;
  breakdown: {
    skills: number;
    experience: number;
    communication: number;
    evidence: number;
  };
  why_this_score: string;
  top_gaps: string[];
  next_actions: string[];
  computed_at: string;
  inputs_hash: string;
  resume_id?: string | null;
  version_id?: string | null;
};

export type ReadinessSnapshot = {
  id: string;
  overall_score: number;
  computed_at: string;
  delta_vs_prev: number;
};

const computeReadiness = async (payload: ReadinessRequest): Promise<ReadinessResponse> =>
  authenticatedJson(
    "/interview/readiness/compute",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Failed to compute readiness",
  );

const getReadinessHistory = async (
  targetRole: string,
  jobDescription = "",
  limit = 20,
): Promise<{ target_role: string; jd_hash: string; history: ReadinessSnapshot[] }> => {
  const query = new URLSearchParams({
    target_role: targetRole,
    job_description: jobDescription,
    limit: String(limit),
  });
  return authenticatedJson(
    `/interview/readiness/history?${query.toString()}`,
    { method: "GET" },
    "Failed to fetch readiness history",
  );
};

export const readinessApi = {
  computeReadiness,
  getReadinessHistory,
};
