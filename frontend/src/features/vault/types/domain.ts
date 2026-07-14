export type TimestampLike =
  | string
  | number
  | { seconds: number; nanos: number }
  | Date
  | null;

export type ResumeName = string | { raw?: string | null } | null;

import type { ResumeSkillGroup } from 'features/vault/utils/resumeSkills';

export type { ResumeSkillGroup };

export interface ResumeEducationHighlight {
  label: string;
  text: string;
}

export interface ResumeEducationRecord {
  degree?: string | null;
  field?: string | null;
  minor?: string | null;
  institution?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  dates?: string | null;
  cgpa?: string | null;
  location?: string | null;
  highlights?: ResumeEducationHighlight[];
}

export type ResumeEmploymentType =
  | 'intern'
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'freelance'
  | 'co_op'
  | 'temporary'
  | 'volunteer'
  | 'other';

export interface ResumeWorkExperienceItem {
  title?: string | null;
  company?: string | null;
  organization?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  employment_type?: ResumeEmploymentType | string | null;
  responsibilities?: string[];
  impact?: string[];
  tech_stack?: string[];
}

export interface ResumeProjectItem {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  tech_stack?: string[];
  technologies?: string[];
  role?: string | null;
  scale?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  link?: string | null;
}

export interface ResumeAchievementItem {
  title?: string | null;
  name?: string | null;
  description?: string | null;
  date?: string | null;
}

export interface ResumePublicationItem {
  title?: string | null;
  venue?: string | null;
  year?: string | null;
  link?: string | null;
}

export interface ResumeCustomSection {
  title: string;
  lines?: string[];
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
  skills?: ResumeSkillGroup[];
  education?: ResumeEducationRecord[];
  work_experience?: ResumeWorkExperienceItem[];
  projects?: ResumeProjectItem[];
  achievements?: ResumeAchievementItem[];
  publications?: ResumePublicationItem[];
  custom_sections?: ResumeCustomSection[];
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
  origin?: 'upload' | 'builder';
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
  builder?: {
    template_id: string;
    template_version: string;
    rendered_tex_hash: string;
    section_layout?: Array<Record<string, unknown>>;
  } | null;
}

export interface VaultMeta {
  resume_count: number;
  active_resume_id: string | null;
}
