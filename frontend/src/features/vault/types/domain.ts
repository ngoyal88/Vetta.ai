export type TimestampLike =
  | string
  | number
  | { seconds: number; nanos: number }
  | Date
  | null;

export type ResumeName = string | { raw?: string | null } | null;

export interface ResumeSkills {
  languages?: string[];
  frameworks?: string[];
  databases?: string[];
  cloud?: string[];
  tools?: string[];
  ml_ai?: string[];
  other?: string[];
}

export interface ResumeProfile {
  name?: ResumeName;
  contact?: {
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    links?: {
      github?: string | null;
      linkedin?: string | null;
      portfolio?: string | null;
      other?: string[];
    };
  };
  summary?: string | null;
  years_experience?: number | null;
  seniority_level?: string;
  skills?: ResumeSkills | Array<{ name: string }>;
  education?: unknown[];
  work_experience?: unknown[];
  projects?: unknown[];
  achievements?: unknown[];
  publications?: unknown[];
  weak_areas?: string[];
  raw_text?: string | null;
  [key: string]: unknown;
}

export interface ScorePoint {
  version_number: number;
  score: number;
  created_at: TimestampLike;
  version_id?: string | null;
  action?: string | null;
  role?: string | null;
}

export interface VaultScorecard {
  score: number;
  coverage_counts: Record<string, number>;
  summary_line: string;
  role_fit_score?: number | null;
  role_fit_role?: string | null;
  ats_flags: string[];
  weak_areas: string[];
  suggestions: string[];
  last_analyzed_at: TimestampLike;
}

export interface VaultEntry {
  id: string;
  user_id?: string;
  name: string;
  tags: string[];
  is_active: boolean;
  created_at?: TimestampLike;
  last_updated?: TimestampLike;
  current_version_id?: string | null;
  version_count: number;
  scorecard?: VaultScorecard | null;
  score_history?: ScorePoint[];
  interview_session_ids?: string[];
  avg_interview_score?: number | null;
}

export interface VaultVersion {
  id: string;
  resume_id: string;
  version_number: number;
  created_at: TimestampLike;
  user_note: string;
  score_at_version?: number | null;
  latest_score?: number | null;
  diff_summary?: string | null;
  profile_snapshot: ResumeProfile;
  source_filename?: string | null;
  content_type?: string | null;
  has_source_file?: boolean;
  storage_path?: string | null;
  storage_backend?: string | null;
}

export interface VaultMeta {
  resume_count: number;
  active_resume_id: string | null;
}
