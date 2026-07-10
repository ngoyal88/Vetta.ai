import type { SaveState } from '../hooks/draftAutosave';
import type { ResumeBuilderDraft } from '../types/resumeBuilder';
import {
  canonicalizeLink,
  compareDates,
  countWords,
  getLinkEntries,
  hasCompleteEducationEntry,
  hasCompleteProjectEntry,
  hasCompleteSkillGroup,
  hasConsistentSectionDates,
  hasMeaningfulResumeContent,
  hasQuantifiedRecentWork,
  hasValidProfessionalLink,
  isNonEmptyText,
  isSectionAbandoned,
  isValidEmail,
  normalizeText,
  parseDateValue,
  seemsLikeLink,
} from './builderReadinessPredicates';

export type BuilderReadinessSeverity = 'blocking' | 'warning' | 'info';
export type BuilderReadinessCategory = 'identity' | 'links' | 'content' | 'dates' | 'layout' | 'publish';
export type BuilderReadinessStatus = 'ready' | 'needs_review' | 'blocked';
export type BuilderReadinessDimension =
  | 'identity'
  | 'content_presence'
  | 'summary'
  | 'links'
  | 'work_completeness'
  | 'work_metrics'
  | 'work_dates'
  | 'education_completeness'
  | 'education_dates'
  | 'projects_completeness'
  | 'project_dates'
  | 'skills_completeness'
  | 'custom_content'
  | 'save_state'
  | 'preview_state';

export type BuilderReadinessIssue = {
  id: string;
  severity: BuilderReadinessSeverity;
  category: BuilderReadinessCategory;
  dimension: BuilderReadinessDimension;
  title: string;
  message: string;
  sectionId?: string;
  fieldPath?: string;
  fixHint?: string;
};

export type BuilderReadinessStrength = {
  id: string;
  dimension: BuilderReadinessDimension;
  category: BuilderReadinessCategory;
  title: string;
  message: string;
  sectionId?: string;
  fieldPath?: string;
};

export type BuilderReadinessResult = {
  status: BuilderReadinessStatus;
  strengths: BuilderReadinessStrength[];
  blocking: BuilderReadinessIssue[];
  warnings: BuilderReadinessIssue[];
  info: BuilderReadinessIssue[];
};

type ComputeBuilderReadinessInput = {
  draft: ResumeBuilderDraft | null;
  saveState: SaveState;
  previewStatus?: 'idle' | 'ready' | 'failed';
  pageCount?: number;
};

type StrengthRule = {
  id: string;
  dimension: BuilderReadinessDimension;
  category: BuilderReadinessCategory;
  title: string;
  message: string;
  sectionId?: string;
  fieldPath?: string;
  when: (input: ComputeBuilderReadinessInput & { draft: ResumeBuilderDraft }) => boolean;
};

const STRENGTH_RULES: StrengthRule[] = [
  {
    id: 'strength-identity-complete',
    dimension: 'identity',
    category: 'identity',
    title: 'Contact header is complete',
    message: 'Your name and email are ready for publishing.',
    sectionId: 'identity',
    fieldPath: 'profile.contact.email',
    when: ({ draft }) => isNonEmptyText(draft.profile.name) && isValidEmail(draft.profile.contact?.email),
  },
  {
    id: 'strength-content-present',
    dimension: 'content_presence',
    category: 'content',
    title: 'Resume has substantive content',
    message: 'You already have meaningful content beyond the identity section.',
    when: ({ draft }) => hasMeaningfulResumeContent(draft),
  },
  {
    id: 'strength-summary-solid',
    dimension: 'summary',
    category: 'content',
    title: 'Summary length looks appropriate',
    message: 'The summary is present and stays within a readable range.',
    sectionId: 'summary',
    fieldPath: 'profile.summary',
    when: ({ draft }) => {
      const summary = normalizeText(draft.profile.summary);
      return Boolean(summary) && summary.length <= 500 && countWords(summary) >= 8;
    },
  },
  {
    id: 'strength-link-present',
    dimension: 'links',
    category: 'links',
    title: 'Professional link included',
    message: 'Your contact section includes a link recruiters can open.',
    sectionId: 'identity',
    fieldPath: 'profile.contact.links',
    when: ({ draft }) => hasValidProfessionalLink(draft),
  },
  {
    id: 'strength-recent-work-metrics',
    dimension: 'work_metrics',
    category: 'content',
    title: 'Recent role shows measurable impact',
    message: 'Your latest experience already includes quantified evidence.',
    sectionId: 'work_experience',
    fieldPath: 'profile.work_experience[0]',
    when: ({ draft }) => hasQuantifiedRecentWork(draft),
  },
  {
    id: 'strength-work-dates-consistent',
    dimension: 'work_dates',
    category: 'dates',
    title: 'Work dates look consistent',
    message: 'Your experience dates use recognizable formats and sensible ranges.',
    sectionId: 'work_experience',
    when: ({ draft }) => hasConsistentSectionDates(draft.profile.work_experience),
  },
  {
    id: 'strength-education-complete',
    dimension: 'education_completeness',
    category: 'content',
    title: 'Education section is filled in',
    message: 'At least one education entry includes both a degree and an institution.',
    sectionId: 'education',
    when: ({ draft }) => hasCompleteEducationEntry(draft),
  },
  {
    id: 'strength-projects-complete',
    dimension: 'projects_completeness',
    category: 'content',
    title: 'Projects section adds depth',
    message: 'You have at least one project with both a title and a description.',
    sectionId: 'projects',
    when: ({ draft }) => hasCompleteProjectEntry(draft),
  },
  {
    id: 'strength-skills-complete',
    dimension: 'skills_completeness',
    category: 'content',
    title: 'Skills are grouped and filled in',
    message: 'Your skills section includes at least one complete skill group.',
    sectionId: 'skills',
    when: ({ draft }) => hasCompleteSkillGroup(draft),
  },
  {
    id: 'strength-synced',
    dimension: 'save_state',
    category: 'publish',
    title: 'All changes saved',
    message: 'The latest draft state is already synced.',
    when: ({ saveState }) => saveState === 'synced',
  },
  {
    id: 'strength-preview-ready',
    dimension: 'preview_state',
    category: 'publish',
    title: 'PDF preview generated successfully',
    message: 'The latest preview compiled successfully in this session.',
    when: ({ previewStatus }) => previewStatus === 'ready',
  },
];

function addIssue(issues: BuilderReadinessIssue[], nextIssue: BuilderReadinessIssue, seen: Set<string>) {
  if (seen.has(nextIssue.id)) return;
  seen.add(nextIssue.id);
  issues.push(nextIssue);
}

function addStrength(strengths: BuilderReadinessStrength[], nextStrength: BuilderReadinessStrength, seen: Set<string>) {
  if (seen.has(nextStrength.id)) return;
  seen.add(nextStrength.id);
  strengths.push(nextStrength);
}

function issueDimensions(...collections: BuilderReadinessIssue[][]): Set<BuilderReadinessDimension> {
  return new Set(collections.flat().map((issue) => issue.dimension));
}

export function computeBuilderReadiness(input: ComputeBuilderReadinessInput): BuilderReadinessResult {
  const { draft, saveState, previewStatus = 'idle' } = input;
  const strengths: BuilderReadinessStrength[] = [];
  const blocking: BuilderReadinessIssue[] = [];
  const warnings: BuilderReadinessIssue[] = [];
  const info: BuilderReadinessIssue[] = [];
  const seenIssues = new Set<string>();
  const seenStrengths = new Set<string>();

  if (!draft) {
    return { status: 'blocked', strengths, blocking, warnings, info };
  }

  const profile = draft.profile;

  if (!isNonEmptyText(profile.name)) {
    addIssue(blocking, {
      id: 'identity-name-missing',
      severity: 'blocking',
      category: 'identity',
      dimension: 'identity',
      title: 'Name is missing',
      message: 'Add your full name before publishing.',
      sectionId: 'identity',
      fieldPath: 'profile.name',
      fixHint: 'Enter the name you want recruiters to see in the resume header.',
    }, seenIssues);
  }

  if (!isValidEmail(profile.contact?.email)) {
    addIssue(blocking, {
      id: 'identity-email-invalid',
      severity: 'blocking',
      category: 'identity',
      dimension: 'identity',
      title: 'Email is missing or invalid',
      message: 'Use a valid email address before publishing.',
      sectionId: 'identity',
      fieldPath: 'profile.contact.email',
      fixHint: 'Use a contactable email like name@example.com.',
    }, seenIssues);
  }

  if (saveState === 'save_failed') {
    addIssue(blocking, {
      id: 'publish-save-failed',
      severity: 'blocking',
      category: 'publish',
      dimension: 'save_state',
      title: "Couldn't save your latest changes",
      message: 'Retry saving before publishing so Vault gets your latest draft.',
      fixHint: 'Use Save and wait for the status to return to All changes saved.',
    }, seenIssues);
  }

  if (previewStatus === 'failed') {
    addIssue(blocking, {
      id: 'publish-preview-failed',
      severity: 'blocking',
      category: 'publish',
      dimension: 'preview_state',
      title: 'Preview failed',
      message: 'Refresh the PDF preview successfully before publishing.',
      fixHint: 'Use Preview PDF again and resolve any compile issue first.',
    }, seenIssues);
  }

  if (!hasMeaningfulResumeContent(draft)) {
    addIssue(blocking, {
      id: 'content-empty-resume',
      severity: 'blocking',
      category: 'content',
      dimension: 'content_presence',
      title: 'Resume has no content yet',
      message: 'Add at least one meaningful section beyond identity before publishing.',
      fixHint: 'Start with summary, projects, work experience, or education.',
    }, seenIssues);
  }

  const summary = normalizeText(profile.summary);
  if (summary.length > 500) {
    addIssue(warnings, {
      id: 'summary-too-long',
      severity: 'warning',
      category: 'layout',
      dimension: 'summary',
      title: 'Summary is getting long',
      message: 'Consider tightening the summary before publishing.',
      sectionId: 'summary',
      fieldPath: 'profile.summary',
    }, seenIssues);
  } else if (summary && countWords(summary) < 8) {
    addIssue(info, {
      id: 'summary-very-short',
      severity: 'info',
      category: 'content',
      dimension: 'summary',
      title: 'Summary is very short',
      message: 'A slightly fuller summary may help clarify your direction.',
      sectionId: 'summary',
      fieldPath: 'profile.summary',
    }, seenIssues);
  }

  const linkEntries = getLinkEntries(draft);
  const canonicalLinks = new Map<string, string>();
  for (const entry of linkEntries) {
    if (!entry.value) continue;
    if (!seemsLikeLink(entry.value)) {
      addIssue(warnings, {
        id: `link-malformed-${entry.key}`,
        severity: 'warning',
        category: 'links',
        dimension: 'links',
        title: `${entry.label} looks incomplete`,
        message: 'Use a URL or profile link that a recruiter can open.',
        sectionId: 'identity',
        fieldPath: entry.fieldPath,
        fixHint: 'Examples: github.com/username, linkedin.com/in/name, or your portfolio URL.',
      }, seenIssues);
    }
    const canonical = canonicalizeLink(entry.value);
    const existingKey = canonicalLinks.get(canonical);
    if (existingKey) {
      addIssue(warnings, {
        id: `link-duplicate-${existingKey}-${entry.key}`,
        severity: 'warning',
        category: 'links',
        dimension: 'links',
        title: 'Duplicate professional links',
        message: 'The same link appears more than once in your contact details.',
        sectionId: 'identity',
        fieldPath: entry.fieldPath,
      }, seenIssues);
    } else {
      canonicalLinks.set(canonical, entry.key);
    }
  }

  if (linkEntries.every((entry) => !entry.value) && hasMeaningfulResumeContent(draft)) {
    addIssue(info, {
      id: 'links-missing',
      severity: 'info',
      category: 'links',
      dimension: 'links',
      title: 'Consider adding a professional link',
      message: 'A LinkedIn, portfolio, or relevant profile can help recruiters learn more about you.',
      sectionId: 'identity',
      fieldPath: 'profile.contact.links',
    }, seenIssues);
  }

  const allBullets = new Map<string, string>();
  const workItems = profile.work_experience || [];
  workItems.forEach((item, index) => {
    const title = normalizeText(item.title);
    const company = normalizeText(item.company || item.organization);
    const start = normalizeText(item.start_date);
    const end = normalizeText(item.end_date);
    const bullets = [...(item.responsibilities || []), ...(item.impact || [])]
      .map(normalizeText)
      .filter(Boolean);

    if ((title && !company) || (!title && company)) {
      addIssue(warnings, {
        id: `work-partial-${index}`,
        severity: 'warning',
        category: 'content',
        dimension: 'work_completeness',
        title: 'Work experience entry is incomplete',
        message: 'Each experience entry should include both a company and a role title.',
        sectionId: 'work_experience',
        fieldPath: `profile.work_experience[${index}]`,
      }, seenIssues);
    }

    if (start || end) {
      const parsedStart = parseDateValue(start);
      const parsedEnd = parseDateValue(end);
      if (start && !parsedStart) {
        addIssue(warnings, {
          id: `work-start-date-invalid-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'work_dates',
          title: 'Work start date looks invalid',
          message: 'Use a recognizable date format like MM/YYYY or YYYY.',
          sectionId: 'work_experience',
          fieldPath: `profile.work_experience[${index}].start_date`,
        }, seenIssues);
      }
      if (end && !parsedEnd && !/^(present|current|ongoing|now)$/i.test(end)) {
        addIssue(warnings, {
          id: `work-end-date-invalid-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'work_dates',
          title: 'Work end date looks invalid',
          message: 'Use a recognizable date format like MM/YYYY, YYYY, or Present.',
          sectionId: 'work_experience',
          fieldPath: `profile.work_experience[${index}].end_date`,
        }, seenIssues);
      }
      if (parsedStart && parsedEnd && compareDates(parsedStart, parsedEnd) > 0) {
        addIssue(warnings, {
          id: `work-date-range-reversed-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'work_dates',
          title: 'Work date range is reversed',
          message: 'The end date appears earlier than the start date.',
          sectionId: 'work_experience',
          fieldPath: `profile.work_experience[${index}]`,
        }, seenIssues);
      }
    }

    if (bullets.length > 7) {
      addIssue(warnings, {
        id: `work-bullets-many-${index}`,
        severity: 'warning',
        category: 'layout',
        dimension: 'work_completeness',
        title: 'One experience entry has many bullet points',
        message: 'The PDF may become harder to scan with this many bullets in one role.',
        sectionId: 'work_experience',
        fieldPath: `profile.work_experience[${index}]`,
      }, seenIssues);
    }

    bullets.forEach((bullet, bulletIndex) => {
      const canonical = bullet.toLowerCase();
      const firstPath = allBullets.get(canonical);
      if (firstPath) {
        addIssue(warnings, {
          id: `work-bullet-duplicate-${index}-${bulletIndex}`,
          severity: 'warning',
          category: 'content',
          dimension: 'work_completeness',
          title: 'Duplicate bullet text detected',
          message: 'The same bullet appears more than once. Consider consolidating or rewriting it.',
          sectionId: 'work_experience',
          fieldPath: `profile.work_experience[${index}]`,
        }, seenIssues);
      } else {
        allBullets.set(canonical, `profile.work_experience[${index}]`);
      }
    });
  });

  const recentBullets = [...((workItems[0]?.responsibilities || []).map(normalizeText)), ...((workItems[0]?.impact || []).map(normalizeText))].filter(Boolean);
  if (recentBullets.length > 0 && !hasQuantifiedRecentWork(draft)) {
    addIssue(warnings, {
      id: 'recent-work-no-metrics',
      severity: 'warning',
      category: 'content',
      dimension: 'work_metrics',
      title: 'Most recent role has no quantified impact',
      message: 'Try adding at least one metric, percentage, or scale indicator in your recent experience.',
      sectionId: 'work_experience',
      fieldPath: 'profile.work_experience[0]',
    }, seenIssues);
  }

  const educationItems = profile.education || [];
  educationItems.forEach((item, index) => {
    const degree = normalizeText(item.degree || item.field);
    const institution = normalizeText(item.institution);
    const start = normalizeText(item.start_date);
    const end = normalizeText(item.end_date);
    const hasHighlights = (item.highlights || []).some((highlight) =>
      isNonEmptyText(highlight.label) || isNonEmptyText(highlight.text),
    );

    if ((degree && !institution) || (!degree && institution)) {
      addIssue(warnings, {
        id: `education-partial-${index}`,
        severity: 'warning',
        category: 'content',
        dimension: 'education_completeness',
        title: 'Education entry is incomplete',
        message: 'Each education entry should include both a degree/field and an institution.',
        sectionId: 'education',
        fieldPath: `profile.education[${index}]`,
      }, seenIssues);
    }

    if ((item.highlights || []).some((highlight) => isNonEmptyText(highlight.label) !== isNonEmptyText(highlight.text))) {
      addIssue(warnings, {
        id: `education-highlight-partial-${index}`,
        severity: 'warning',
        category: 'content',
        dimension: 'education_completeness',
        title: 'Education highlight is incomplete',
        message: 'Each labeled highlight should include both a label and supporting text.',
        sectionId: 'education',
        fieldPath: `profile.education[${index}].highlights`,
      }, seenIssues);
    }

    if (!degree && !institution && hasHighlights) {
      addIssue(warnings, {
        id: `education-abandoned-${index}`,
        severity: 'warning',
        category: 'content',
        dimension: 'education_completeness',
        title: 'Education details look unfinished',
        message: 'This education item has notes but no degree or institution.',
        sectionId: 'education',
        fieldPath: `profile.education[${index}]`,
      }, seenIssues);
    }

    if (start || end) {
      const parsedStart = parseDateValue(start);
      const parsedEnd = parseDateValue(end);
      if (start && !parsedStart) {
        addIssue(warnings, {
          id: `education-start-date-invalid-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'education_dates',
          title: 'Education start date looks invalid',
          message: 'Use a recognizable date format like MM/YYYY or YYYY.',
          sectionId: 'education',
          fieldPath: `profile.education[${index}].start_date`,
        }, seenIssues);
      }
      if (end && !parsedEnd && !/^(present|current|ongoing|now)$/i.test(end)) {
        addIssue(warnings, {
          id: `education-end-date-invalid-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'education_dates',
          title: 'Education end date looks invalid',
          message: 'Use a recognizable date format like MM/YYYY, YYYY, or Present.',
          sectionId: 'education',
          fieldPath: `profile.education[${index}].end_date`,
        }, seenIssues);
      }
      if (parsedStart && parsedEnd && compareDates(parsedStart, parsedEnd) > 0) {
        addIssue(warnings, {
          id: `education-date-range-reversed-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'education_dates',
          title: 'Education date range is reversed',
          message: 'The end date appears earlier than the start date.',
          sectionId: 'education',
          fieldPath: `profile.education[${index}]`,
        }, seenIssues);
      }
    }
  });

  (profile.projects || []).forEach((item, index) => {
    const name = normalizeText(item.name || item.title);
    const description = normalizeText(item.description || item.summary);
    const start = normalizeText(item.start_date);
    const end = normalizeText(item.end_date);

    if (name && !description) {
      addIssue(warnings, {
        id: `project-description-missing-${index}`,
        severity: 'warning',
        category: 'content',
        dimension: 'projects_completeness',
        title: 'Project description is empty',
        message: 'Add 1–2 lines explaining what the project does and your impact.',
        sectionId: 'projects',
        fieldPath: `profile.projects[${index}].description`,
      }, seenIssues);
    }

    const projectLink = normalizeText(item.link);
    if (projectLink && !seemsLikeLink(projectLink)) {
      addIssue(warnings, {
        id: `project-link-malformed-${index}`,
        severity: 'warning',
        category: 'links',
        dimension: 'links',
        title: 'Project link looks incomplete',
        message: 'Use a URL that a recruiter can open from the PDF.',
        sectionId: 'projects',
        fieldPath: `profile.projects[${index}].link`,
      }, seenIssues);
    }

    if (start || end) {
      const parsedStart = parseDateValue(start);
      const parsedEnd = parseDateValue(end);
      if (start && !parsedStart) {
        addIssue(warnings, {
          id: `project-start-date-invalid-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'project_dates',
          title: 'Project start date looks invalid',
          message: 'Use a recognizable date format like MM/YYYY or YYYY.',
          sectionId: 'projects',
          fieldPath: `profile.projects[${index}].start_date`,
        }, seenIssues);
      }
      if (end && !parsedEnd && !/^(present|current|ongoing|now)$/i.test(end)) {
        addIssue(warnings, {
          id: `project-end-date-invalid-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'project_dates',
          title: 'Project end date looks invalid',
          message: 'Use a recognizable date format like MM/YYYY, YYYY, or Present.',
          sectionId: 'projects',
          fieldPath: `profile.projects[${index}].end_date`,
        }, seenIssues);
      }
      if (parsedStart && parsedEnd && compareDates(parsedStart, parsedEnd) > 0) {
        addIssue(warnings, {
          id: `project-date-range-reversed-${index}`,
          severity: 'warning',
          category: 'dates',
          dimension: 'project_dates',
          title: 'Project date range is reversed',
          message: 'The end date appears earlier than the start date.',
          sectionId: 'projects',
          fieldPath: `profile.projects[${index}]`,
        }, seenIssues);
      }
    }
  });

  ensureBuilderSkillWarnings(draft, warnings, seenIssues);
  ensureCustomSectionWarnings(draft, warnings, seenIssues);
  ensureAbandonedEnabledSectionInfo(draft, info, seenIssues);

  const activeDimensions = issueDimensions(blocking, warnings, info);
  for (const rule of STRENGTH_RULES) {
    if (activeDimensions.has(rule.dimension)) continue;
    if (!rule.when({ ...input, draft })) continue;
    addStrength(strengths, {
      id: rule.id,
      dimension: rule.dimension,
      category: rule.category,
      title: rule.title,
      message: rule.message,
      sectionId: rule.sectionId,
      fieldPath: rule.fieldPath,
    }, seenStrengths);
  }

  const status: BuilderReadinessStatus = blocking.length > 0
    ? 'blocked'
    : warnings.length > 0 || info.length > 0
      ? 'needs_review'
      : 'ready';

  return { status, strengths, blocking, warnings, info };
}

function ensureBuilderSkillWarnings(draft: ResumeBuilderDraft, warnings: BuilderReadinessIssue[], seen: Set<string>) {
  (draft.profile.skills || []).forEach((group, index) => {
    const label = normalizeText(group.label);
    const itemCount = (group.items || []).map(normalizeText).filter(Boolean).length;
    if ((label && itemCount === 0) || (!label && itemCount > 0)) {
      addIssue(warnings, {
        id: `skills-group-partial-${index}`,
        severity: 'warning',
        category: 'content',
        dimension: 'skills_completeness',
        title: 'Skill group is incomplete',
        message: 'Each skill group should have both a label and at least one skill item.',
        sectionId: 'skills',
        fieldPath: `profile.skills[${index}]`,
      }, seen);
    }
  });
}

function ensureCustomSectionWarnings(draft: ResumeBuilderDraft, warnings: BuilderReadinessIssue[], seen: Set<string>) {
  draft.custom_sections.forEach((section, index) => {
    const title = normalizeText(section.title);
    const content = normalizeText(section.content);
    if (title && !content) {
      addIssue(warnings, {
        id: `custom-section-empty-${section.id}`,
        severity: 'warning',
        category: 'content',
        dimension: 'custom_content',
        title: `"${title}" has no content yet`,
        message: 'Add content or remove the section before publishing.',
        sectionId: section.id,
        fieldPath: `custom_sections[${index}].content`,
      }, seen);
    }
    if (content.length > 900) {
      addIssue(warnings, {
        id: `custom-section-long-${section.id}`,
        severity: 'warning',
        category: 'layout',
        dimension: 'custom_content',
        title: `"${title || 'Custom section'}" may overflow the template`,
        message: 'Shorten or split the content before publishing.',
        sectionId: section.id,
        fieldPath: `custom_sections[${index}].content`,
      }, seen);
    }
  });
}

function ensureAbandonedEnabledSectionInfo(draft: ResumeBuilderDraft, info: BuilderReadinessIssue[], seen: Set<string>) {
  const enabledSections = draft.section_layout.filter((section) => section.kind !== 'identity' && section.enabled);
  enabledSections.forEach((section) => {
    if (!isSectionAbandoned(draft, section.kind)) return;
    addIssue(info, {
      id: `section-enabled-empty-${section.id}`,
      severity: 'info',
      category: 'content',
      dimension: 'content_presence',
      title: `"${section.label}" looks empty`,
      message: 'Consider hiding this section before publishing if you are not using it.',
      sectionId: section.id,
    }, seen);
  });
}
