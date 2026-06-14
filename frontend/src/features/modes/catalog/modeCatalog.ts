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

import { MODE_ROUTE_BY_SLUG, type ModeSlug } from 'core/constants/interviewModes';

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

export const MODE_CATALOG: ModeCatalogEntry[] = [
  {
    slug: 'role_targeted',
    title: 'Role-Targeted',
    summary:
      'Simulate specific job requirements. The AI assumes the persona of a hiring manager for your targeted role, interrogating your domain expertise.',
    tagline: 'Hiring-manager persona · domain depth',
    highlights: [
      'Company and role calibration',
      'Technical and system-design focus',
      'Difficulty tuned to target loop',
    ],
    comingSoon: false,
    difficulty: 'Hard',
    badgeTone: 'hard',
    accent: 'primary',
    ctaLabel: 'Initiate Session',
    ctaVariant: 'primary',
    icon: Target,
    ctaIcon: ArrowRight,
    route: MODE_ROUTE_BY_SLUG.role_targeted,
  },
  {
    slug: 'resume_deep_dive',
    title: 'Resume Deep-Dive',
    summary:
      'Defend your experience. A forensic examination of your uploaded resume, probing for inconsistencies and testing your impact narratives.',
    tagline: 'Forensic resume defense',
    highlights: [
      'Vault resume ingestion',
      'Gap and narrative stress tests',
      'Adjustable scan depth',
    ],
    comingSoon: false,
    difficulty: 'Medium',
    badgeTone: 'medium',
    accent: 'tertiary',
    ctaLabel: 'Upload & Start',
    ctaVariant: 'outline',
    icon: FileSearch,
    ctaIcon: Upload,
    route: MODE_ROUTE_BY_SLUG.resume_deep_dive,
  },
  {
    slug: 'pressure',
    title: 'Pressure Cooker',
    summary: 'Rapid-fire technical and behavioral questions with strict time limits.',
    tagline: 'Closed beta',
    highlights: ['Strict timers', 'Mixed technical + behavioral', 'High cognitive load'],
    comingSoon: true,
    status: 'Currently in closed beta.',
    icon: Flame,
    route: MODE_ROUTE_BY_SLUG.pressure,
  },
  {
    slug: 'blind',
    title: 'Blind Audition',
    summary: 'Focus purely on vocal delivery and content without visual biases.',
    tagline: 'In training',
    highlights: ['Voice-only evaluation', 'Delivery and clarity focus', 'Bias-reduced format'],
    comingSoon: true,
    status: 'Algorithm training in progress.',
    icon: EyeOff,
    route: MODE_ROUTE_BY_SLUG.blind,
  },
  {
    slug: 'pair_programming',
    title: 'Pair Programming',
    summary: 'Live collaborative coding with a Senior Engineer AI persona.',
    tagline: 'IDE integration pending',
    highlights: ['Pair with senior engineer AI', 'Live problem solving', 'Code + voice hybrid'],
    comingSoon: true,
    status: 'Awaiting IDE integration.',
    icon: Code2,
    route: MODE_ROUTE_BY_SLUG.pair_programming,
  },
];

export const ACTIVE_MODES = MODE_CATALOG.filter((mode) => !mode.comingSoon);
export const COMING_SOON_MODES = MODE_CATALOG.filter((mode) => mode.comingSoon);
