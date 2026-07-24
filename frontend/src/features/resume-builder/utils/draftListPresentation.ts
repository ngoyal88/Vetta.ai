import type { ResumeBuilderDraft, TemplateMetadata } from '../types/resumeBuilder';

import { getTemplateLabel } from './draftNames';

const GENERIC_TEMPLATE_TAGS = new Set(['single column', 'two column', 'multi column', 'multi-column']);

export function getDraftListTitle(draft: Pick<ResumeBuilderDraft, 'name'>): string {
  const name = draft.name?.trim();
  if (name) return name;
  return 'Untitled draft';
}

export function getTemplateShortLabel(
  template: Pick<TemplateMetadata, 'tags' | 'display_name' | 'id'>,
): string {
  const tags = template.tags.filter(Boolean);
  const distinctive = tags.filter((tag) => !GENERIC_TEMPLATE_TAGS.has(tag.toLowerCase()));
  if (distinctive.length > 0) {
    return distinctive.slice(0, 2).join(' · ');
  }
  return getTemplateLabel(template);
}

export function resolveTemplateShortLabel(
  templateId: string,
  templates: Array<Pick<TemplateMetadata, 'id' | 'tags' | 'display_name'>>,
): string {
  const template = templates.find((entry) => entry.id === templateId);
  return template ? getTemplateShortLabel(template) : templateId.replace(/_/g, ' ');
}

export function getTemplateAccentTags(
  template: Pick<TemplateMetadata, 'tags' | 'display_name' | 'id'> | undefined,
): string[] {
  if (!template) return [];
  const tags = template.tags.filter(Boolean);
  const distinctive = tags.filter((tag) => !GENERIC_TEMPLATE_TAGS.has(tag.toLowerCase()));
  if (distinctive.length > 0) return distinctive.slice(0, 2);
  if (template.display_name?.trim()) return [template.display_name.trim()];
  if (tags.length > 0) return [tags[0]];
  return [template.id.replace(/_/g, ' ')];
}
