export { INTERVIEW_SETUP_STEPS as SETUP_STEPS } from '../../shared/constants/setupSteps';
export { RESUME_SCAN_DEPTH_STOPS as SCAN_DEPTH_STOPS } from '../../shared/constants/difficultyStops';

export const OBJECTIVE_OPTIONS = [
  { id: 'ats', label: 'ATS Optimization' },
  { id: 'technical_gaps', label: 'Technical Gap Analysis' },
  { id: 'narrative', label: 'Career Narrative Alignment' },
  { id: 'market', label: 'Market Competitiveness' },
] as const;

export type ObjectiveId = (typeof OBJECTIVE_OPTIONS)[number]['id'];

export const INDUSTRY_SUGGESTIONS = [
  'Fintech',
  'AI / ML SaaS',
  'Enterprise B2B',
  'Consumer Tech',
  'Healthcare Tech',
  'E-commerce',
  'Cybersecurity',
  'Cloud Infrastructure',
] as const;

export const DEFAULT_OBJECTIVES: ObjectiveId[] = ['narrative', 'technical_gaps'];
