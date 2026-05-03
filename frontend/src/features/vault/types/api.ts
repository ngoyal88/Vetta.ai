import type { ResumeProfile, VaultEntry, VaultMeta, VaultScorecard, VaultVersion } from "./domain";

export interface VaultListResponse {
  entries: VaultEntry[];
  meta: VaultMeta;
}

export interface VaultUploadResponse {
  entry: VaultEntry;
  version: VaultVersion;
  scorecard: VaultScorecard;
}

export interface VaultAnalyzeResponse {
  scorecard: VaultScorecard;
}

export interface VaultCompareResponse {
  score_a: number;
  score_b: number;
  score_delta: number;
  skills_only_in_a: string[];
  skills_only_in_b: string[];
  recommended_id: "a" | "b";
  recommendation_reason: string;
  section_verdicts: Record<string, unknown>;
  resume_a_id?: string;
  resume_b_id?: string;
}

export interface VaultVersionsResponse {
  versions: VaultVersion[];
}

export interface VaultRestoreResponse {
  resume_id: string;
  version_id: string;
  scorecard: VaultScorecard;
}

export interface UploadResumePayload {
  file: File;
  name: string;
  tags?: string;
  resumeId?: string;
  userNote?: string;
  role?: string;
}

export interface VaultUpdatePayload {
  name?: string;
  tags?: string[];
}

export type ActiveResumeProfileResponse = ResumeProfile | null;
