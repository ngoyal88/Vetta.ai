import type { ResumeEducationRecord, ResumeProfile } from 'features/vault/types/domain';

import { normalizeSkillGroups } from 'features/vault/utils/resumeSkills';

const MAX_SKILL_GROUPS = 25;
const MAX_SKILL_ITEMS = 40;
const MAX_SKILL_LABEL_LEN = 80;
const MAX_SKILL_ITEM_LEN = 120;
const MAX_EDUCATION_HIGHLIGHTS = 12;

function sanitizeEducation(education: ResumeEducationRecord[] | undefined): ResumeEducationRecord[] {
  return (education || []).map((entry) => ({
    ...entry,
    highlights: (entry.highlights || [])
      .filter((highlight) => highlight.label.trim() && highlight.text.trim())
      .slice(0, MAX_EDUCATION_HIGHLIGHTS)
      .map((highlight) => ({
        label: highlight.label.trim().slice(0, 80),
        text: highlight.text.trim().slice(0, 500),
      })),
  }));
}

/** Strip builder-only fields and cap sizes before API persistence. */
export function sanitizeBuilderProfileForSave(profile: ResumeProfile): ResumeProfile {
  const skills = normalizeSkillGroups(profile.skills, { keepEmptyGroups: false })
    .slice(0, MAX_SKILL_GROUPS)
    .map((group) => ({
      label: group.label.trim().slice(0, MAX_SKILL_LABEL_LEN),
      items: group.items
        .map((item) => item.trim().slice(0, MAX_SKILL_ITEM_LEN))
        .filter(Boolean)
        .slice(0, MAX_SKILL_ITEMS),
    }))
    .filter((group) => group.label || group.items.length > 0);

  return {
    ...profile,
    skills,
    education: sanitizeEducation(profile.education),
  };
}
