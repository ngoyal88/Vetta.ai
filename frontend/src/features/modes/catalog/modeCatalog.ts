import {
  ArrowRight,
  Code2,
  EyeOff,
  FileSearch,
  Flame,
  Target,
  Upload,
  type LucideIcon,
} from 'lucide-react';

import {
  getCatalogModes,
  getModeRoute,
  type ModeSlug,
} from 'features/interview/domain/modeContract';

export type { ModeSlug } from 'features/interview/domain/modeContract';
export {
  AI_INTERVIEW_ANALYTICS_PATH,
  AI_INTERVIEW_HISTORY_PATH,
  AI_INTERVIEW_HUB_PATH,
  MODE_ROUTE_BY_SLUG,
} from 'features/interview/domain/modeContract';

export type DifficultyBadge = 'Hard' | 'Medium';
export type BadgeTone = 'hard' | 'medium';
export type AccentTone = 'primary' | 'tertiary';
export type CtaVariant = 'primary' | 'outline';

export type ModeCatalogEntry = {
  slug: ModeSlug;
  title: string;
  summary: string;
  tagline: string;
  highlights: readonly string[];
  comingSoon: boolean;
  icon: LucideIcon;
  route: string;
  difficulty?: DifficultyBadge;
  badgeTone?: BadgeTone;
  accent?: AccentTone;
  ctaLabel?: string;
  ctaVariant?: CtaVariant;
  ctaIcon?: LucideIcon;
  status?: string;
};

/** Marketing copy keyed by catalog slug — routes/titles/comingSoon from modeContract. */
const MARKETING_BY_SLUG: Record<
  ModeSlug,
  Omit<ModeCatalogEntry, 'slug' | 'title' | 'comingSoon' | 'route'>
> = {
  role_targeted: {
    summary:
      'Simulate specific job requirements. The AI assumes the persona of a hiring manager for your targeted role, interrogating your domain expertise.',
    tagline: 'Hiring-manager persona · domain depth',
    highlights: [
      'Company and role calibration',
      'Technical and system-design focus',
      'Difficulty tuned to target loop',
    ],
    difficulty: 'Hard',
    badgeTone: 'hard',
    accent: 'primary',
    ctaLabel: 'Initiate Session',
    ctaVariant: 'primary',
    icon: Target,
    ctaIcon: ArrowRight,
  },
  resume_deep_dive: {
    summary:
      'Defend your experience. A forensic examination of your uploaded resume, probing for inconsistencies and testing your impact narratives.',
    tagline: 'Forensic resume defense',
    highlights: [
      'Vault resume ingestion',
      'Gap and narrative stress tests',
      'Adjustable scan depth',
    ],
    difficulty: 'Medium',
    badgeTone: 'medium',
    accent: 'tertiary',
    ctaLabel: 'Upload & Start',
    ctaVariant: 'outline',
    icon: FileSearch,
    ctaIcon: Upload,
  },
  pressure: {
    summary: 'Rapid-fire technical and behavioral questions with strict time limits.',
    tagline: 'Closed beta',
    highlights: ['Strict timers', 'Mixed technical + behavioral', 'High cognitive load'],
    status: 'Currently in closed beta.',
    icon: Flame,
  },
  blind: {
    summary: 'Focus purely on vocal delivery and content without visual biases.',
    tagline: 'In training',
    highlights: ['Voice-only evaluation', 'Delivery and clarity focus', 'Bias-reduced format'],
    status: 'Algorithm training in progress.',
    icon: EyeOff,
  },
  pair_programming: {
    summary: 'Live collaborative coding with a Senior Engineer AI collaborator.',
    tagline: 'DSA track live',
    highlights: ['Pair with senior engineer AI', 'Live problem solving', 'Code + voice hybrid'],
    difficulty: 'Hard',
    badgeTone: 'hard',
    accent: 'primary',
    ctaLabel: 'Start Pair Session',
    ctaVariant: 'primary',
    status: 'DSA track available now.',
    icon: Code2,
    ctaIcon: ArrowRight,
  },
};

export const MODE_CATALOG: ModeCatalogEntry[] = getCatalogModes().map((mode) => {
  const slug = mode.catalogSlug!;
  const marketing = MARKETING_BY_SLUG[slug];
  return {
    slug,
    title: mode.title,
    comingSoon: mode.comingSoon,
    route: getModeRoute(slug),
    ...marketing,
  };
});

export const ACTIVE_MODES = MODE_CATALOG.filter((mode) => !mode.comingSoon);
export const COMING_SOON_MODES = MODE_CATALOG.filter((mode) => mode.comingSoon);

// Re-export alias for consumers that expect MODE_ROUTES
export { MODE_ROUTE_BY_SLUG as MODE_ROUTES } from 'features/interview/domain/modeContract';
