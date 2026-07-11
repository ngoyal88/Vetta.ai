import type { BuilderSectionKind, TemplateMetadata } from '../types/resumeBuilder';

export const DEFAULT_SECTION_FIELDS: Record<BuilderSectionKind, string[]> = {
  identity: ['name', 'email', 'phone', 'location', 'github', 'linkedin', 'portfolio', 'other_links'],
  summary: ['summary'],
  work_experience: [
    'title',
    'company',
    'location',
    'start_date',
    'end_date',
    'employment_type',
    'responsibilities',
    'impact',
    'tech_stack',
  ],
  education: [
    'degree',
    'field',
    'minor',
    'institution',
    'location',
    'start_date',
    'end_date',
    'cgpa',
    'highlights',
  ],
  skills: ['label', 'items'],
  projects: ['name', 'description', 'role', 'start_date', 'end_date', 'link', 'tech_stack', 'scale'],
  achievements: ['title', 'description', 'date'],
  publications: ['title', 'venue', 'year', 'link'],
  custom: ['content'],
};

const KNOWN_FIELDS = new Map(
  Object.entries(DEFAULT_SECTION_FIELDS).map(([kind, fields]) => [kind, new Set(fields)]),
);

export function defaultSectionFields(kind: BuilderSectionKind): string[] {
  return [...(DEFAULT_SECTION_FIELDS[kind] ?? [])];
}

export function resolveSectionFields(
  template: TemplateMetadata | null | undefined,
  kind: BuilderSectionKind,
): string[] {
  const defaults = defaultSectionFields(kind);
  const known = KNOWN_FIELDS.get(kind) ?? new Set<string>();
  const configured = template?.sections?.[kind]?.fields;
  if (!configured?.length) {
    return defaults;
  }

  const resolved: string[] = [];
  for (const fieldId of configured) {
    if (!known.has(fieldId) || resolved.includes(fieldId)) {
      continue;
    }
    resolved.push(fieldId);
  }
  return resolved.length > 0 ? resolved : defaults;
}
