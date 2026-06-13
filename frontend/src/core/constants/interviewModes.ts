/**
 * Interview mode routes — canonical slugs and paths for App.jsx / AiInterviewPage.
 */

export const AI_INTERVIEW_HUB_PATH = '/ai-interview';
export const AI_INTERVIEW_HISTORY_PATH = '/ai-interview/history';
export const AI_INTERVIEW_ANALYTICS_PATH = '/ai-interview/analytics';

export type ModeSlug =
  | 'role_targeted'
  | 'pressure'
  | 'resume_deep_dive'
  | 'blind'
  | 'pair_programming';

export const MODE_ROUTE_BY_SLUG: Record<ModeSlug, string> = {
  role_targeted: '/ai-interview/role-targeted',
  pressure: '/ai-interview/pressure-mode',
  resume_deep_dive: '/ai-interview/resume-deep-dive',
  blind: '/ai-interview/blind-mode',
  pair_programming: '/ai-interview/pair-programming',
};
