import type { ResumeProfile } from '../types/domain';

/** Canonical skill shape: user-defined group label + skill items. */
export interface ResumeSkillGroup {
  label: string;
  items: string[];
}

/** Builder editor row — `itemsText` is local textarea state only. */
export type BuilderSkillGroup = ResumeSkillGroup & {
  itemsText?: string;
};

function cleanItems(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return [...new Set(cleaned)];
}

export function normalizeSkillGroups(
  skills: ResumeProfile['skills'],
  options?: { keepEmptyGroups?: boolean },
): BuilderSkillGroup[] {
  const keepEmptyGroups = options?.keepEmptyGroups ?? false;
  if (!Array.isArray(skills)) return [];

  return skills
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as {
        label?: string | null;
        items?: unknown;
        itemsText?: string;
      };
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const items = cleanItems(record.items);
      if (!keepEmptyGroups && !label && items.length === 0) return null;
      const group: BuilderSkillGroup = { label, items };
      if (typeof record.itemsText === 'string') {
        group.itemsText = record.itemsText;
      }
      return group;
    })
    .filter((group): group is BuilderSkillGroup => group !== null);
}

export function ensureBuilderSkillGroups(skills: ResumeProfile['skills']): BuilderSkillGroup[] {
  return normalizeSkillGroups(skills, { keepEmptyGroups: true });
}

export function createEmptySkillGroup(): BuilderSkillGroup {
  return { label: '', items: [] };
}
