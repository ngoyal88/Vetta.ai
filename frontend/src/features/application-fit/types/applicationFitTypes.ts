import { getModeRoute } from 'features/interview/domain/modeContract';

export type LayerVerdict = 'pass' | 'at_risk' | 'fail';
export type BottleneckStage = 'ats_filter' | 'recruiter_screen' | 'hm_review' | 'none';
export type FitBand = 'strong' | 'competitive' | 'stretch' | 'long_shot';
export type HeroVerdict = 'apply_now' | 'fix_before_apply' | 'long_shot';
export type ActionType = 'resume_edit' | 'practice' | 'apply' | 'timing';
export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type MatchStatus = 'strong' | 'partial' | 'missing' | 'unclear';
export type AlignmentMode = 'llm' | 'fallback';
export type RoleAlignmentLevel = 'strong' | 'partial' | 'weak';
export type RequirementCategory =
  | 'technical_skill'
  | 'experience'
  | 'education'
  | 'certification'
  | 'domain'
  | 'seniority'
  | 'location'
  | 'work_authorization'
  | 'language'
  | 'management'
  | 'travel'
  | 'employment_type'
  | 'soft_skill';
export type RequirementImportance = 'required' | 'preferred' | 'bonus';
export type RequirementStrictness = 'hard' | 'flexible';
export type RequirementFunnelStage = BottleneckStage;
export type RequirementAlignmentStatus = 'met' | 'partial' | 'missing' | 'unknown' | 'not_applicable';
export type RequirementCategoryGroup =
  | 'technical'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'domain'
  | 'logistics'
  | 'leadership'
  | 'resume_signal';
export type GateStatus = 'clear' | 'risky' | 'blocked';
export type EvidenceSource = 'resume' | 'profile_memory';

export type RequirementAlignment = {
  jd_requirement: string;
  match_status: MatchStatus;
  confidence: number;
  resume_evidence?: string | null;
  equivalent_terms_found: string[];
};

export type RequirementSatisfyMode = 'all' | 'any';

export type TypedRequirement = {
  id: string;
  category: RequirementCategory;
  text: string;
  alternatives?: string[];
  satisfy_mode?: RequirementSatisfyMode;
  importance: RequirementImportance;
  strictness: RequirementStrictness;
  funnel_stage: RequirementFunnelStage;
  weight: number;
  is_hard_gate: boolean;
};

export type RequirementAlignmentV2 = {
  requirement: TypedRequirement;
  status: RequirementAlignmentStatus;
  confidence: number;
  evidence?: string | null;
  reason: string;
};

export type EvidenceChunk = {
  id: string;
  source: EvidenceSource;
  section: string;
  label: string;
  text: string;
  visible_on_resume: boolean;
  verified: boolean;
};

export type RequirementEvidenceResult = {
  requirement_id: string;
  requirement_text: string;
  category: RequirementCategory;
  importance: RequirementImportance;
  funnel_stage?: RequirementFunnelStage;
  weight?: number;
  resume_status: RequirementAlignmentStatus;
  candidate_status: RequirementAlignmentStatus;
  confidence: number;
  resume_evidence?: EvidenceChunk | null;
  memory_evidence?: EvidenceChunk | null;
  reason: string;
  score_impact: number;
};

export type ScoreExplanation = {
  required_met: number;
  required_partial: number;
  required_missing: number;
  preferred_met: number;
  hard_gates_failed: string[];
  top_strengths: string[];
  top_gaps: string[];
  evidence_summary: string;
};

export type CategoryScore = {
  category: RequirementCategoryGroup;
  score: number;
  met: number;
  partial: number;
  missing: number;
  unknown: number;
};

export type HardGateFinding = {
  requirement: string;
  status: RequirementAlignmentStatus;
  category: RequirementCategory;
  reason: string;
};

export type RoleRelevanceSignals = {
  title_alignment: RoleAlignmentLevel;
  domain_alignment: RoleAlignmentLevel;
};

export type ATSLayerResult = {
  verdict: LayerVerdict;
  coverage_pct: number;
  missing_keywords: string[];
  ats_format_warnings: string[];
};

export type RecruiterLayerResult = {
  verdict: LayerVerdict;
  score: number;
  signals: Record<string, number>;
};

export type HMLayerResult = {
  verdict: LayerVerdict;
  score: number;
  missing_skills: string[];
  vpm_boostable_skills: string[];
};

export type FunnelResult = {
  ats: ATSLayerResult;
  recruiter: RecruiterLayerResult;
  hm_application: HMLayerResult;
  hm_prepared?: HMLayerResult | null;
};

export type RankedAction = {
  priority: ActionPriority;
  label: string;
  detail: string;
  estimated_impact: string;
  action_type: ActionType;
  vpm_evidence_available?: boolean;
};

export type PostingFreshness = {
  first_seen: string;
  hours_old: number;
  urgency: 'high' | 'medium' | 'low';
  recommendation: string;
};

export type ComputeResponse = {
  snapshot_id: string;
  bottleneck_stage: BottleneckStage;
  bottleneck_label: string;
  hero_verdict: HeroVerdict;
  hero_summary: string;
  hero_primary_action_label?: string | null;
  report_mode: 'decision_first';
  application_fit_score: number;
  prepared_fit_score: number | null;
  prepared_fit_delta: number;
  resume_fit_score?: number | null;
  candidate_fit_score?: number | null;
  resume_gap_score: number;
  score_explanation: ScoreExplanation;
  requirement_results: RequirementEvidenceResult[];
  fit_band: FitBand;
  posting_freshness?: PostingFreshness | null;
  funnel: FunnelResult;
  ranked_actions: RankedAction[];
  matched_skills: string[];
  missing_skills: string[];
  vpm_boostable_skills: string[];
  why_this_score: string;
  jd_fit_context: Record<string, unknown>;
  resume_id?: string | null;
  version_id?: string | null;
  inputs_hash: string;
  jd_hash: string;
  computed_at: string;
  extraction_mode: 'llm' | 'fallback';
  requirement_alignments: RequirementAlignment[];
  alignment_mode: AlignmentMode;
  typed_requirements: TypedRequirement[];
  requirement_alignments_v2: RequirementAlignmentV2[];
  category_scores: CategoryScore[];
  gate_status: GateStatus;
  hard_gate_findings: HardGateFinding[];
  unknown_signals: string[];
  score_reducers: string[];
  score_strengths: string[];
  resume_mutation_available: boolean;
  warnings: string[];
};

export type ComputeRequest = {
  target_role: string;
  target_company?: string;
  job_description: string;
  resume_id?: string;
  version_id?: string;
  first_seen?: string;
};

export type HistoryEntry = {
  snapshot_id: string;
  application_fit_score: number;
  prepared_fit_score: number | null;
  bottleneck_stage: BottleneckStage;
  bottleneck_label: string;
  computed_at: string;
  delta_vs_previous: number | null;
};

export type HistoryResponse = {
  history: HistoryEntry[];
};

export type ApplicationFitView = 'input' | 'loading' | 'report';

export const JD_MAX_CHARS = 8000;
export const JD_MIN_CHARS = 40;

/** Gate before compute API — ponytail: min lengths only; sync with backend MIN_JD_CHARS. */
export function canAnalyzeApplicationFit(targetRole: string, jobDescription: string): boolean {
  return targetRole.trim().length >= 2 && jobDescription.trim().length >= JD_MIN_CHARS;
}

export const FIT_BAND_LABELS: Record<FitBand, string> = {
  strong: 'Strong',
  competitive: 'Competitive',
  stretch: 'Stretch',
  long_shot: 'Long shot',
};

export const VERDICT_LABELS: Record<LayerVerdict, string> = {
  pass: 'PASS',
  at_risk: 'AT_RISK',
  fail: 'FAIL',
};

export function practiceInterviewHref(snapshotId: string, targetRole: string): string {
  const params = new URLSearchParams({
    jd_fit_snapshot_id: snapshotId,
    target_role: targetRole,
  });
  return `${getModeRoute('role_targeted')}?${params.toString()}`;
}

export function canOpenBuilderFromReport(report: Pick<ComputeResponse, 'resume_id'>): boolean {
  return Boolean(report.resume_id?.trim());
}

export function builderEditHref(args: {
  resumeId: string;
  versionId?: string | null;
  jdFitSnapshotId?: string | null;
}): string {
  const params = new URLSearchParams({ resumeId: args.resumeId });
  if (args.versionId?.trim()) params.set('versionId', args.versionId.trim());
  if (args.jdFitSnapshotId?.trim()) params.set('jd_fit_snapshot_id', args.jdFitSnapshotId.trim());
  return `/resume-vault/builder?${params.toString()}`;
}

export function builderEditHrefFromReport(
  report: Pick<ComputeResponse, 'resume_id' | 'version_id'>,
  jdFitSnapshotId: string,
): string | null {
  const resumeId = report.resume_id?.trim();
  if (!resumeId) return null;
  return builderEditHref({
    resumeId,
    versionId: report.version_id,
    jdFitSnapshotId,
  });
}
