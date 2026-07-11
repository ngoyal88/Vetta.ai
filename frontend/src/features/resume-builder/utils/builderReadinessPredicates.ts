import type { ResumeBuilderDraft } from '../types/resumeBuilder';

type ParsedDate = { year: number; month: number };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRESENT_REGEX = /^(present|current|ongoing|now)$/i;
const URL_SCHEME_REGEX = /^https?:\/\//i;
const URL_LIKE_REGEX = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i;

export type LinkEntry = {
  key: string;
  value: string;
  label: string;
  fieldPath: string;
};

export function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return '';
}

export function isNonEmptyText(value: unknown): boolean {
  return normalizeText(value).length > 0;
}

export function isValidEmail(value: unknown): boolean {
  return EMAIL_REGEX.test(normalizeText(value));
}

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function parseDateValue(value: string | null | undefined): ParsedDate | null {
  const text = normalizeText(value);
  if (!text || PRESENT_REGEX.test(text)) return null;

  let match = text.match(/^(\d{4})$/);
  if (match) return { year: Number(match[1]), month: 1 };

  match = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    if (month >= 1 && month <= 12) return { year: Number(match[2]), month };
    return null;
  }

  match = text.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year: Number(match[1]), month };
    return null;
  }

  const parsed = new Date(`1 ${text}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
}

export function compareDates(a: ParsedDate, b: ParsedDate): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function seemsLikeLink(value: string): boolean {
  if (!value) return false;
  if (URL_SCHEME_REGEX.test(value)) return true;
  if (URL_LIKE_REGEX.test(value)) return true;
  return value.includes('.') && !value.includes(' ');
}

export function canonicalizeLink(value: string): string {
  return value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

export function getLinkEntries(draft: ResumeBuilderDraft): LinkEntry[] {
  const links = draft.profile.contact?.links;
  return [
    { key: 'github', value: normalizeText(links?.github), label: 'GitHub', fieldPath: 'profile.contact.links.github' },
    { key: 'linkedin', value: normalizeText(links?.linkedin), label: 'LinkedIn', fieldPath: 'profile.contact.links.linkedin' },
    { key: 'portfolio', value: normalizeText(links?.portfolio), label: 'Portfolio', fieldPath: 'profile.contact.links.portfolio' },
    ...((links?.other || []).map((value, index) => ({
      key: `other-${index}`,
      value: normalizeText(value),
      label: 'Other link',
      fieldPath: `profile.contact.links.other[${index}]`,
    }))),
  ];
}

export function hasMeaningfulSkillsItems(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.skills || []).some((group) =>
    (group.items || []).some((item) => isNonEmptyText(item)),
  );
}

export function hasMeaningfulProjects(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.projects || []).some((project) =>
    [project.name, project.title, project.description, project.summary, project.link].some(isNonEmptyText),
  );
}

export function hasMeaningfulWorkExperience(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.work_experience || []).some((item) =>
    [
      item.title,
      item.company,
      item.organization,
      item.location,
      item.start_date,
      item.end_date,
      ...(item.responsibilities || []),
      ...(item.impact || []),
    ].some(isNonEmptyText),
  );
}

export function hasMeaningfulEducation(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.education || []).some((item) =>
    [
      item.degree,
      item.field,
      item.institution,
      item.location,
      item.start_date,
      item.end_date,
      ...(item.highlights || []).flatMap((highlight) => [highlight.label, highlight.text]),
    ].some(isNonEmptyText),
  );
}

export function hasMeaningfulAchievements(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.achievements || []).some((item) =>
    [item.title, item.name, item.description, item.date].some(isNonEmptyText),
  );
}

export function hasMeaningfulPublications(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.publications || []).some((item) =>
    [item.title, item.venue, item.year, item.link].some(isNonEmptyText),
  );
}

export function hasMeaningfulCustomSections(draft: ResumeBuilderDraft): boolean {
  return draft.custom_sections.some((section) => isNonEmptyText(section.title) || isNonEmptyText(section.content));
}

export function hasMeaningfulResumeContent(draft: ResumeBuilderDraft): boolean {
  return [
    draft.profile.summary,
    hasMeaningfulSkillsItems(draft),
    hasMeaningfulProjects(draft),
    hasMeaningfulWorkExperience(draft),
    hasMeaningfulEducation(draft),
    hasMeaningfulAchievements(draft),
    hasMeaningfulPublications(draft),
    hasMeaningfulCustomSections(draft),
  ].some(Boolean);
}

export function hasQuantifiedRecentWork(draft: ResumeBuilderDraft): boolean {
  const workItem = draft.profile.work_experience?.[0];
  const bullets = [...(workItem?.responsibilities || []), ...(workItem?.impact || [])]
    .map(normalizeText)
    .filter(Boolean);
  return bullets.some((bullet) => /\d/.test(bullet));
}

export function hasValidProfessionalLink(draft: ResumeBuilderDraft): boolean {
  return getLinkEntries(draft).some((entry) => entry.value && seemsLikeLink(entry.value));
}

export function hasCompleteEducationEntry(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.education || []).some((item) =>
    isNonEmptyText(item.degree || item.field) && isNonEmptyText(item.institution),
  );
}

export function hasCompleteProjectEntry(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.projects || []).some((item) =>
    isNonEmptyText(item.name || item.title) && isNonEmptyText(item.description || item.summary),
  );
}

export function hasCompleteSkillGroup(draft: ResumeBuilderDraft): boolean {
  return (draft.profile.skills || []).some((group) =>
    isNonEmptyText(group.label) && (group.items || []).map(normalizeText).filter(Boolean).length > 0,
  );
}

export function hasConsistentSectionDates(
  items: Array<{ start_date?: string | null; end_date?: string | null }> | undefined,
): boolean {
  if (!items || items.length === 0) return false;
  let hasAnyDate = false;
  for (const item of items) {
    const start = normalizeText(item.start_date);
    const end = normalizeText(item.end_date);
    if (!start && !end) continue;
    hasAnyDate = true;
    const parsedStart = start ? parseDateValue(start) : null;
    const parsedEnd = end && !PRESENT_REGEX.test(end) ? parseDateValue(end) : null;
    if ((start && !parsedStart) || (end && !PRESENT_REGEX.test(end) && !parsedEnd)) return false;
    if (parsedStart && parsedEnd && compareDates(parsedStart, parsedEnd) > 0) return false;
  }
  return hasAnyDate;
}

export function isSectionAbandoned(draft: ResumeBuilderDraft, kind: ResumeBuilderDraft['section_layout'][number]['kind']): boolean {
  switch (kind) {
    case 'summary':
      return false;
    case 'work_experience':
      return (draft.profile.work_experience || []).length > 0 && !hasMeaningfulWorkExperience(draft);
    case 'education':
      return (draft.profile.education || []).length > 0 && !hasMeaningfulEducation(draft);
    case 'skills':
      return (draft.profile.skills || []).length > 0 && !hasMeaningfulSkillsItems(draft);
    case 'projects':
      return (draft.profile.projects || []).length > 0 && !hasMeaningfulProjects(draft);
    case 'achievements':
      return (draft.profile.achievements || []).length > 0 && !hasMeaningfulAchievements(draft);
    case 'publications':
      return (draft.profile.publications || []).length > 0 && !hasMeaningfulPublications(draft);
    case 'custom':
      return draft.custom_sections.some((section) => isNonEmptyText(section.title) && !isNonEmptyText(section.content));
    default:
      return false;
  }
}
