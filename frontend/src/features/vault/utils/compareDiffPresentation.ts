import type {
  ComparePaneChanges,
  ComparePaneSectionGroup,
  CompareSectionDiff,
  VaultCompareResponse,
} from '../types';

const SECTION_ORDER = ['summary', 'skills', 'experience', 'projects'] as const;

const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
};

function sortSections<T extends { section: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (left, right) =>
      SECTION_ORDER.indexOf(left.section as (typeof SECTION_ORDER)[number])
      - SECTION_ORDER.indexOf(right.section as (typeof SECTION_ORDER)[number]),
  );
}

function hasSectionContent(section: CompareSectionDiff): boolean {
  return Boolean(
    section.only_in_a?.length || section.only_in_b?.length || section.changed?.length,
  );
}

function buildLegacySectionDiffs(result: VaultCompareResponse): CompareSectionDiff[] {
  const rows: CompareSectionDiff[] = [];

  const skillsA = result.skills_only_in_a ?? [];
  const skillsB = result.skills_only_in_b ?? [];
  if (skillsA.length || skillsB.length) {
    rows.push({
      section: 'skills',
      label: SECTION_LABELS.skills,
      only_in_a: skillsA,
      only_in_b: skillsB,
      changed: [],
      verdict: skillsA.length && skillsB.length ? 'mixed' : skillsB.length ? 'b_stronger' : 'a_stronger',
    });
  }

  const highlights = result.section_highlights ?? {};
  for (const section of SECTION_ORDER) {
    if (section === 'skills') continue;
    const highlight = highlights[section];
    if (!highlight) continue;
    rows.push({
      section,
      label: SECTION_LABELS[section],
      only_in_a: [],
      only_in_b: [highlight],
      changed: [],
      verdict: 'mixed',
    });
  }

  return sortSections(rows);
}

export function normalizeSectionDiffs(result: VaultCompareResponse): CompareSectionDiff[] {
  const fromApi = (result.section_diffs ?? []).filter(hasSectionContent);
  if (fromApi.length) {
    return sortSections(
      fromApi.map((row) => ({
        ...row,
        label: row.label || SECTION_LABELS[row.section as (typeof SECTION_ORDER)[number]] || row.section,
        only_in_a: row.only_in_a ?? [],
        only_in_b: row.only_in_b ?? [],
        changed: row.changed ?? [],
      })),
    );
  }
  return buildLegacySectionDiffs(result);
}

function groupPaneSections(side: 'a' | 'b', sections: CompareSectionDiff[]): ComparePaneSectionGroup[] {
  const groups: ComparePaneSectionGroup[] = [];
  for (const section of sections) {
    const items = side === 'a' ? section.only_in_a : section.only_in_b;
    if (!items.length) continue;
    groups.push({
      section: section.section,
      label: section.label,
      items,
    });
  }
  return groups;
}

export function buildPaneChanges(result: VaultCompareResponse): ComparePaneChanges {
  if (result.pane_changes?.a || result.pane_changes?.b) {
    return {
      a: result.pane_changes.a ?? [],
      b: result.pane_changes.b ?? [],
    };
  }
  const sections = normalizeSectionDiffs(result);
  return {
    a: groupPaneSections('a', sections),
    b: groupPaneSections('b', sections),
  };
}

export function buildActualDiffSections(result: VaultCompareResponse): CompareSectionDiff[] {
  return normalizeSectionDiffs(result).filter(hasSectionContent);
}

export function compareDocumentsAreSame(nameA: string, nameB: string): boolean {
  return nameA.trim() === nameB.trim();
}

export function formatCompareSubtitle(
  nameA: string,
  nameB: string,
  versionANumber: number,
  versionBNumber: number,
): string {
  const trimmedA = nameA.trim();
  const trimmedB = nameB.trim();
  if (compareDocumentsAreSame(nameA, nameB)) {
    return `${trimmedA} · v${versionANumber} vs v${versionBNumber}`;
  }
  return `${trimmedA} v${versionANumber} vs ${trimmedB} v${versionBNumber}`;
}

export function formatOnlyInLabel(
  name: string,
  versionNumber: number,
  sameDocument: boolean,
): string {
  if (sameDocument) {
    return `Only in v${versionNumber}`;
  }
  return `Only in ${name.trim()}`;
}

export function formatCompareSideLabel(
  side: 'a' | 'b',
  name: string,
  versionNumber: number,
  sameDocument: boolean,
): string {
  if (sameDocument) {
    return `Version ${versionNumber}`;
  }
  const letter = side === 'a' ? 'A' : 'B';
  return `Resume ${letter} · ${name.trim()}`;
}
