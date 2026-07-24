const RESUME_DRAFT_NAME_RE = /^Resume\((\d+)\)$/i;

export function isAutoDraftName(name: string): boolean {
  return RESUME_DRAFT_NAME_RE.test(name.trim());
}

export function nextResumeDraftName(existingNames: string[]): string {
  const usedNumbers = new Set<number>();

  existingNames.forEach((raw) => {
    const name = raw.trim();
    if (!name) return;
    const match = RESUME_DRAFT_NAME_RE.exec(name);
    if (match) {
      usedNumbers.add(Number(match[1]));
    }
  });

  let number = 1;
  while (usedNumbers.has(number)) {
    number += 1;
  }
  return `Resume(${number})`;
}

export function getDraftDisplayName(draft: { name?: string | null; profile?: { name?: unknown } | null }): string {
  const draftName = draft.name?.trim();
  if (draftName) return draftName;

  if (typeof draft.profile?.name === 'string' && draft.profile.name.trim()) {
    return draft.profile.name.trim();
  }

  return 'Resume(1)';
}

export function getTemplateLabel(template: Pick<{ tags: string[]; display_name?: string; id: string }, 'tags' | 'display_name' | 'id'>): string {
  const tags = template.tags.filter(Boolean);
  if (tags.length > 0) return tags.join(' · ');
  if (template.display_name?.trim()) return template.display_name.trim();
  return template.id.replace(/_/g, ' ');
}

export function resolveTemplateLabel(
  templateId: string,
  templates: Array<{ id: string; tags: string[]; display_name?: string }>,
): string {
  const template = templates.find((entry) => entry.id === templateId);
  return template ? getTemplateLabel(template) : templateId.replace(/_/g, ' ');
}
