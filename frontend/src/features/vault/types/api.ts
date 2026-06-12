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
  resume_id: string;
  version_id: string;
  version_number?: number | null;
  scorecard: VaultScorecard;
  entry_scorecard_updated: boolean;
}

export type CompareSectionVerdict = "improved" | "regressed" | "unchanged" | "mixed";

export type CompareSectionDiffVerdict = "a_stronger" | "b_stronger" | "unchanged" | "mixed";

export interface CompareChangedItem {
  label: string;
  before: string;
  after: string;
}

export interface CompareSectionDiff {
  section: string;
  label: string;
  only_in_a: string[];
  only_in_b: string[];
  changed: CompareChangedItem[];
  verdict?: CompareSectionDiffVerdict;
}

export interface ComparePaneSectionGroup {
  section: string;
  label: string;
  items: string[];
}

export interface ComparePaneChanges {
  a: ComparePaneSectionGroup[];
  b: ComparePaneSectionGroup[];
}

/** Legacy API shape — `baseline_summary` / `target_summary` map to resume A / resume B. */
export interface CompareSectionComparison {
  section: string;
  label: string;
  baseline_summary: string;
  target_summary: string;
  verdict: CompareSectionVerdict;
}

/** Resume A/B view of {@link CompareSectionComparison} for UI and helpers. */
export type ResumePeerSectionComparison = Omit<
  CompareSectionComparison,
  'baseline_summary' | 'target_summary'
> & {
  resume_a_summary: string;
  resume_b_summary: string;
};

export interface VaultCompareResponse {
  score_a: number;
  score_b: number;
  score_delta: number;
  skills_only_in_a: string[];
  skills_only_in_b: string[];
  recommended_id: "a" | "b";
  recommendation_reason: string;
  section_verdicts: Record<string, unknown>;
  diff_summary?: string | null;
  section_highlights?: Record<string, string> | null;
  section_comparisons?: CompareSectionComparison[];
  section_diffs?: CompareSectionDiff[];
  pane_changes?: ComparePaneChanges;
  resume_a_id?: string;
  resume_b_id?: string;
  resume_a_version_id?: string;
  resume_b_version_id?: string;
  resume_a_name?: string;
  resume_b_name?: string;
  version_a_number?: number | null;
  version_b_number?: number | null;
  version_a_filename?: string | null;
  version_b_filename?: string | null;
  version_a_has_source_file?: boolean;
  version_b_has_source_file?: boolean;
}

export interface VaultVersionsResponse {
  versions: VaultVersion[];
}

export interface VaultRestoreResponse {
  resume_id: string;
  version_id: string;
  version_number?: number | null;
  restored_current_version?: boolean;
  scorecard: VaultScorecard;
}

export interface VaultStatusResponse {
  status: string;
  active_resume_id?: string | null;
  resume_count?: number;
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
