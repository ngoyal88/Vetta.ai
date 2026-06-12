import type {
  CompareSectionComparison,
  CompareSectionVerdict,
  ResumePeerSectionComparison,
  VaultCompareResponse,
} from '../types';

const SECTION_ORDER = ['summary', 'skills', 'experience', 'projects'] as const;

const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
};

const VALID_VERDICTS = new Set<CompareSectionVerdict>(['improved', 'regressed', 'unchanged', 'mixed']);

function sortSections(rows: CompareSectionComparison[]): CompareSectionComparison[] {
  return [...rows].sort(
    (left, right) =>
      SECTION_ORDER.indexOf(left.section as (typeof SECTION_ORDER)[number])
      - SECTION_ORDER.indexOf(right.section as (typeof SECTION_ORDER)[number]),
  );
}

/** Map legacy API fields to resume A/B naming. */
export function toPeerSectionComparison(row: CompareSectionComparison): ResumePeerSectionComparison {
  const { baseline_summary, target_summary, ...rest } = row;
  return {
    ...rest,
    resume_a_summary: baseline_summary,
    resume_b_summary: target_summary,
  };
}

function buildLegacySectionComparisons(result: VaultCompareResponse): CompareSectionComparison[] {
  const highlights = result.section_highlights ?? {};
  const rows: CompareSectionComparison[] = [];

  for (const section of SECTION_ORDER) {
    if (section === 'skills') {
      const resumeA = (result.skills_only_in_a ?? []).join(', ');
      const resumeB = (result.skills_only_in_b ?? []).join(', ');
      if (resumeA || resumeB) {
        rows.push({
          section,
          label: SECTION_LABELS[section],
          baseline_summary: resumeA || 'No unique skills beyond resume B.',
          target_summary: resumeB || 'No unique skills beyond resume A.',
          verdict: resumeA && resumeB ? 'mixed' : resumeB ? 'improved' : 'regressed',
        });
      }
      continue;
    }

    const highlight = highlights[section];
    if (!highlight) continue;

    rows.push({
      section,
      label: SECTION_LABELS[section],
      baseline_summary: 'Captured in resume A.',
      target_summary: highlight,
      verdict: 'mixed',
    });
  }

  return rows;
}

export function normalizeSectionComparisons(result: VaultCompareResponse): CompareSectionComparison[] {
  const fromApi = (result.section_comparisons ?? []).filter(
    (row) => row.baseline_summary?.trim() || row.target_summary?.trim(),
  );

  if (fromApi.length) {
    return sortSections(
      fromApi.map((row) => ({
        ...row,
        label: row.label || SECTION_LABELS[row.section as (typeof SECTION_ORDER)[number]] || row.section,
        verdict: VALID_VERDICTS.has(row.verdict) ? row.verdict : 'mixed',
      })),
    );
  }

  return sortSections(buildLegacySectionComparisons(result));
}

export function normalizePeerSectionComparisons(
  result: VaultCompareResponse,
): ResumePeerSectionComparison[] {
  return normalizeSectionComparisons(result).map(toPeerSectionComparison);
}

export function getTargetScoreImprovement(scoreA: number, scoreB: number): number | null {
  const delta = scoreB - scoreA;
  return delta > 0 ? delta : null;
}

export function getVerdictLabel(verdict: CompareSectionVerdict): string {
  switch (verdict) {
    case 'improved':
      return 'Improved';
    case 'regressed':
      return 'Regressed';
    case 'unchanged':
      return 'Unchanged';
    default:
      return 'Mixed';
  }
}
