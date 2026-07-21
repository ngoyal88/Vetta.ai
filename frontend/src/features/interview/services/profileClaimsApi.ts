import { runProfileClaimsPoll } from "shared/services/profileClaimsPoll";
import { authenticatedFetch, authenticatedJson } from "shared/services/httpClient";

export type ClaimCategory = "technical" | "experience" | "behavioral" | "gap";
export type ClaimStatus = "pending" | "accepted" | "rejected" | "archived";
export type DemonstrationStrength = "strong" | "adequate" | "weak" | "none";

export type ProfileClaim = {
  id: string;
  claim_text: string;
  claim_category: ClaimCategory;
  demonstration_strength?: DemonstrationStrength;
  evidence_quote?: string;
  status: ClaimStatus;
  confidence?: number;
  evidence_session_id?: string;
  created_at?: string;
  updated_at?: string;
  accepted_at?: string;
  rejected_at?: string;
};

export type ProfileMemorySummaryV1 = {
  schema_version: string;
  technical: Array<{ claim_id?: string; claim_text: string; evidence_quote?: string; updated_at?: string }>;
  experience: Array<{ claim_id?: string; claim_text: string; evidence_quote?: string; updated_at?: string }>;
  behavioral: Array<{ claim_id?: string; claim_text: string; evidence_quote?: string; updated_at?: string }>;
  gaps: Array<{ claim_id?: string; claim_text: string; evidence_quote?: string; updated_at?: string }>;
  accepted_count: number;
  last_refresh?: string;
};

export type ProfileMemoryResponse = {
  summary: ProfileMemorySummaryV1;
  timeline: ProfileClaim[];
};

export type PipelineStatus = "queued" | "running" | "completed" | "failed" | "skipped";

export type SessionProfileClaimsResponse = {
  items: ProfileClaim[];
  strength: ProfileClaim[];
  gaps: ProfileClaim[];
  session_id?: string;
  pipeline_status?: PipelineStatus | null;
  pipeline_stats?: Record<string, unknown> | null;
  pipeline_error?: { code?: string; message?: string } | null;
};

export type PollSessionProfileClaimsResult = SessionProfileClaimsResponse & {
  pollExhausted: boolean;
};

const getProfileClaims = async (
  status?: ClaimStatus,
  limit = 40,
  section?: "strength" | "gap",
  category?: ClaimCategory,
): Promise<{ items: ProfileClaim[] }> => {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (section) query.set("section", section);
  if (category) query.set("category", category);
  query.set("limit", String(limit));
  return authenticatedJson(
    `/interview/profile-claims?${query.toString()}`,
    { method: "GET" },
    "Failed to fetch profile claims",
  );
};

const getSessionProfileClaims = async (sessionId: string): Promise<SessionProfileClaimsResponse> =>
  authenticatedJson(
    `/interview/profile-claims/session/${encodeURIComponent(sessionId)}`,
    { method: "GET" },
    "Failed to fetch session profile claims",
  );

const acceptProfileClaim = async (claimId: string): Promise<{ item: ProfileClaim }> => {
  const response = await authenticatedFetch(
    `/interview/profile-claims/${encodeURIComponent(claimId)}/accept`,
    { method: "POST" },
  );
  if (!response.ok) {
    const detail = response.status === 409 ? "Accepted claims cap reached (50)." : "Failed to accept claim";
    throw new Error(detail);
  }
  return response.json() as Promise<{ item: ProfileClaim }>;
};

const rejectProfileClaim = async (claimId: string): Promise<{ item: ProfileClaim }> =>
  authenticatedJson(
    `/interview/profile-claims/${encodeURIComponent(claimId)}/reject`,
    { method: "POST" },
    "Failed to reject claim",
  );

const bulkUpdateProfileClaims = async (
  items: Array<{ claim_id: string; status: "accepted" | "rejected" }>,
): Promise<{ items: ProfileClaim[]; count: number; errors?: Array<{ claim_id: string; error: string }> }> =>
  authenticatedJson(
    "/interview/profile-claims/bulk",
    {
      method: "POST",
      body: JSON.stringify({ items }),
    },
    "Failed to update profile claims",
  );

const getProfileMemory = async (limit = 60): Promise<ProfileMemoryResponse> =>
  authenticatedJson(
    `/interview/profile-claims/profile-memory?limit=${limit}`,
    { method: "GET" },
    "Failed to fetch profile memory",
  );

const pollSessionProfileClaims = async (
  sessionId: string,
  options?: { intervalMs?: number; maxWaitMs?: number; maxDelayMs?: number },
): Promise<PollSessionProfileClaimsResult> =>
  runProfileClaimsPoll(() => getSessionProfileClaims(sessionId), options);

export const profileClaimsApi = {
  getProfileClaims,
  getSessionProfileClaims,
  pollSessionProfileClaims,
  acceptProfileClaim,
  rejectProfileClaim,
  bulkUpdateProfileClaims,
  getProfileMemory,
};
