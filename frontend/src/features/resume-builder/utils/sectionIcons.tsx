import {
  Award,
  BookOpen,
  Briefcase,
  FileText,
  GraduationCap,
  Layers,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';

import type { BuilderSectionKind } from '../types/resumeBuilder';

const SECTION_ICON_MAP: Record<BuilderSectionKind, LucideIcon> = {
  identity: User,
  summary: FileText,
  work_experience: Briefcase,
  education: GraduationCap,
  skills: Sparkles,
  projects: Layers,
  achievements: Award,
  publications: BookOpen,
  custom: Layers,
};

export function getSectionIcon(kind: BuilderSectionKind): LucideIcon {
  return SECTION_ICON_MAP[kind] ?? FileText;
}
