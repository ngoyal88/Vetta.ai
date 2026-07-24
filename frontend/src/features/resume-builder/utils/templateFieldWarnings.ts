import type { ResumeProfile } from 'features/vault/types/domain';

import type { BuilderSectionKind, TemplateMetadata } from '../types/resumeBuilder';
import { resolveSectionFields } from './sectionFieldRegistry';

const SECTION_KINDS: BuilderSectionKind[] = [
  'summary',
  'work_experience',
  'education',
  'skills',
  'projects',
  'achievements',
  'publications',
];

function sectionHasContent(profile: ResumeProfile, kind: BuilderSectionKind): boolean {
  switch (kind) {
    case 'summary':
      return Boolean(profile.summary?.trim());
    case 'work_experience':
      return Boolean(profile.work_experience?.length);
    case 'education':
      return Boolean(profile.education?.length);
    case 'skills':
      return Boolean(profile.skills?.some((group) => group.items?.length));
    case 'projects':
      return Boolean(profile.projects?.length);
    case 'achievements':
      return Boolean(profile.achievements?.length);
    case 'publications':
      return Boolean(profile.publications?.length);
    default:
      return false;
  }
}

export function computeTemplateFieldWarnings(
  profile: ResumeProfile,
  template: TemplateMetadata | null | undefined,
): string[] {
  if (!template) return [];

  const warnings: string[] = [];
  for (const kind of SECTION_KINDS) {
    if (!sectionHasContent(profile, kind)) continue;
    const fields = resolveSectionFields(template, kind);
    if (fields.length === 0) {
      const label = kind.replace(/_/g, ' ');
      warnings.push(`This layout may not show ${label} — your data is kept if you switch back.`);
    }
  }
  return warnings;
}
