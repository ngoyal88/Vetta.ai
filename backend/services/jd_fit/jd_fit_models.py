"""Pydantic models for JD Fit compute API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

BottleneckStage = Literal["ats_filter", "recruiter_screen", "hm_review", "none"]
LayerVerdict = Literal["pass", "at_risk", "fail"]
FitBand = Literal["strong", "competitive", "stretch", "long_shot"]
HeroVerdict = Literal["apply_now", "fix_before_apply", "long_shot"]
ActionType = Literal["resume_edit", "practice", "apply", "timing"]
ActionPriority = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
ExtractionMode = Literal["llm", "fallback"]
MatchStatus = Literal["strong", "partial", "missing", "unclear"]
AlignmentMode = Literal["llm", "fallback"]
RoleAlignmentLevel = Literal["strong", "partial", "weak"]
RequirementCategory = Literal[
    "technical_skill",
    "experience",
    "education",
    "certification",
    "domain",
    "seniority",
    "location",
    "work_authorization",
    "language",
    "management",
    "travel",
    "employment_type",
    "soft_skill",
]
RequirementImportance = Literal["required", "preferred", "bonus"]
RequirementStrictness = Literal["hard", "flexible"]
RequirementFunnelStage = Literal["ats_filter", "recruiter_screen", "hm_review"]
RequirementSatisfyMode = Literal["all", "any"]
RequirementAlignmentStatus = Literal["met", "partial", "missing", "unknown", "not_applicable"]
RequirementCategoryGroup = Literal[
    "technical",
    "experience",
    "education",
    "certifications",
    "domain",
    "logistics",
    "leadership",
    "resume_signal",
]
GateStatus = Literal["clear", "risky", "blocked"]
EvidenceSource = Literal["resume", "profile_memory"]


class ComputeRequest(BaseModel):
    target_role: str = Field(..., min_length=2, max_length=160)
    target_company: Optional[str] = Field(default=None, max_length=120)
    job_description: str = Field(default="", max_length=8000)
    resume_id: Optional[str] = None
    version_id: Optional[str] = None
    first_seen: Optional[str] = None


class ATSLayerResult(BaseModel):
    verdict: LayerVerdict
    coverage_pct: float
    missing_keywords: List[str] = Field(default_factory=list)
    ats_format_warnings: List[str] = Field(default_factory=list)


class RecruiterLayerResult(BaseModel):
    verdict: LayerVerdict
    score: float
    signals: Dict[str, float] = Field(default_factory=dict)


class HMLayerResult(BaseModel):
    verdict: LayerVerdict
    score: float
    missing_skills: List[str] = Field(default_factory=list)
    vpm_boostable_skills: List[str] = Field(default_factory=list)


class FunnelResult(BaseModel):
    ats: ATSLayerResult
    recruiter: RecruiterLayerResult
    hm_application: HMLayerResult
    hm_prepared: Optional[HMLayerResult] = None


class RankedAction(BaseModel):
    priority: ActionPriority
    label: str
    detail: str = ""
    estimated_impact: str = ""
    action_type: ActionType
    vpm_evidence_available: bool = False


class RequirementAlignment(BaseModel):
    jd_requirement: str
    match_status: MatchStatus
    confidence: float = Field(default=0.5, ge=0, le=1)
    resume_evidence: Optional[str] = None
    equivalent_terms_found: List[str] = Field(default_factory=list)


class TypedRequirement(BaseModel):
    id: str
    category: RequirementCategory
    text: str
    alternatives: List[str] = Field(default_factory=list)
    satisfy_mode: RequirementSatisfyMode = "all"
    importance: RequirementImportance = "required"
    strictness: RequirementStrictness = "flexible"
    funnel_stage: RequirementFunnelStage = "hm_review"
    weight: float = Field(default=0.05, ge=0, le=1)
    is_hard_gate: bool = False


class RequirementAlignmentV2(BaseModel):
    requirement: TypedRequirement
    status: RequirementAlignmentStatus
    confidence: float = Field(default=0.5, ge=0, le=1)
    evidence: Optional[str] = None
    reason: str = ""


class EvidenceChunk(BaseModel):
    id: str
    source: EvidenceSource
    section: str
    label: str = ""
    text: str
    visible_on_resume: bool = True
    verified: bool = False


class RequirementEvidenceResult(BaseModel):
    requirement_id: str
    requirement_text: str
    category: RequirementCategory
    importance: RequirementImportance
    alternatives: List[str] = Field(default_factory=list)
    satisfy_mode: RequirementSatisfyMode = "all"
    funnel_stage: RequirementFunnelStage = "hm_review"
    weight: float = Field(default=0.05, ge=0, le=1)
    resume_status: RequirementAlignmentStatus
    candidate_status: RequirementAlignmentStatus
    confidence: float = Field(default=0.5, ge=0, le=1)
    resume_evidence: Optional[EvidenceChunk] = None
    memory_evidence: Optional[EvidenceChunk] = None
    reason: str = ""
    score_impact: int = 0


class ScoreExplanation(BaseModel):
    required_met: int = 0
    required_partial: int = 0
    required_missing: int = 0
    preferred_met: int = 0
    hard_gates_failed: List[str] = Field(default_factory=list)
    top_strengths: List[str] = Field(default_factory=list)
    top_gaps: List[str] = Field(default_factory=list)
    evidence_summary: str = ""


class CategoryScore(BaseModel):
    category: RequirementCategoryGroup
    score: int = Field(ge=0, le=100)
    met: int = 0
    partial: int = 0
    missing: int = 0
    unknown: int = 0


class HardGateFinding(BaseModel):
    requirement: str
    status: RequirementAlignmentStatus
    category: RequirementCategory
    reason: str = ""


class RoleRelevanceSignals(BaseModel):
    title_alignment: RoleAlignmentLevel = "partial"
    domain_alignment: RoleAlignmentLevel = "partial"


class SemanticAlignmentResult(BaseModel):
    requirements: List[RequirementAlignment] = Field(default_factory=list)
    role_relevance: RoleRelevanceSignals = Field(default_factory=RoleRelevanceSignals)
    alignment_mode: AlignmentMode = "fallback"


class PostingFreshness(BaseModel):
    first_seen: str
    hours_old: int
    urgency: Literal["high", "medium", "low"]
    recommendation: str


class ComputeResponse(BaseModel):
    snapshot_id: str
    bottleneck_stage: BottleneckStage
    bottleneck_label: str
    hero_verdict: HeroVerdict = "fix_before_apply"
    hero_summary: str = ""
    hero_primary_action_label: Optional[str] = None
    report_mode: Literal["decision_first"] = "decision_first"
    application_fit_score: int
    prepared_fit_score: Optional[int] = None
    prepared_fit_delta: int = 0
    resume_fit_score: Optional[int] = None
    candidate_fit_score: Optional[int] = None
    resume_gap_score: int = 0
    score_explanation: ScoreExplanation = Field(default_factory=ScoreExplanation)
    requirement_results: List[RequirementEvidenceResult] = Field(default_factory=list)
    fit_band: FitBand
    posting_freshness: Optional[PostingFreshness] = None
    funnel: FunnelResult
    ranked_actions: List[RankedAction] = Field(default_factory=list)
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    vpm_boostable_skills: List[str] = Field(default_factory=list)
    why_this_score: str = ""
    jd_fit_context: Dict[str, Any] = Field(default_factory=dict)
    resume_id: Optional[str] = None
    version_id: Optional[str] = None
    inputs_hash: str = ""
    jd_hash: str = ""
    computed_at: str = ""
    extraction_mode: ExtractionMode = "llm"
    requirement_alignments: List[RequirementAlignment] = Field(default_factory=list)
    alignment_mode: AlignmentMode = "fallback"
    typed_requirements: List[TypedRequirement] = Field(default_factory=list)
    requirement_alignments_v2: List[RequirementAlignmentV2] = Field(default_factory=list)
    category_scores: List[CategoryScore] = Field(default_factory=list)
    gate_status: GateStatus = "clear"
    hard_gate_findings: List[HardGateFinding] = Field(default_factory=list)
    unknown_signals: List[str] = Field(default_factory=list)
    score_reducers: List[str] = Field(default_factory=list)
    score_strengths: List[str] = Field(default_factory=list)
    resume_mutation_available: bool = False
    warnings: List[str] = Field(default_factory=list)


class HistoryEntry(BaseModel):
    snapshot_id: str
    application_fit_score: int
    prepared_fit_score: Optional[int] = None
    bottleneck_stage: BottleneckStage
    bottleneck_label: str = ""
    computed_at: str
    delta_vs_previous: Optional[int] = None


class HistoryResponse(BaseModel):
    history: List[HistoryEntry] = Field(default_factory=list)


class ExtractJdTextResponse(BaseModel):
    text: str
    char_count: int
    warnings: List[str] = Field(default_factory=list)
