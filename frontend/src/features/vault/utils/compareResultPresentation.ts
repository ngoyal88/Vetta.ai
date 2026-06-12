import type { VaultCompareResponse } from '../types';
import type { CompareResultState } from '../types/compare';
import {
  buildActualDiffSections,
  compareDocumentsAreSame,
  formatCompareSubtitle,
  formatOnlyInLabel,
} from './compareDiffPresentation';
import { formatShortDate } from './vaultUtils';

export function formatCompareTitle(
  nameA: string,
  nameB: string,
  versionANumber: number,
  versionBNumber: number,
): string {
  if (compareDocumentsAreSame(nameA, nameB)) {
    return `Comparison: v${versionANumber} vs v${versionBNumber}`;
  }
  return `${nameA.trim()} vs ${nameB.trim()}`;
}

export function getScoreImprovement(score: number, otherScore: number): number | null {
  const delta = score - otherScore;
  return delta > 0 ? delta : null;
}

export function formatModifiedLabel(createdAt: CompareResultState['selectionA']['version']['created_at']): string {
  const label = formatShortDate(createdAt);
  if (label === 'Unknown') return label;
  return label;
}

export function getRecommendedVersionNumber(
  result: VaultCompareResponse,
  versionANumber: number,
  versionBNumber: number,
): number {
  return result.recommended_id === 'a' ? versionANumber : versionBNumber;
}

export function buildCompareReportText(state: CompareResultState): string {
  const { result, selectionA, selectionB, role } = state;
  const vNumA = result.version_a_number ?? selectionA.version.version_number;
  const vNumB = result.version_b_number ?? selectionB.version.version_number;
  const nameA = result.resume_a_name || selectionA.entry.name;
  const nameB = result.resume_b_name || selectionB.entry.name;
  const sameDocument = compareDocumentsAreSame(nameA, nameB);

  const diffSections = buildActualDiffSections(result);

  const lines = [
    'Vetta Vault — Resume Comparison Report',
    '',
    formatCompareSubtitle(nameA, nameB, vNumA, vNumB),
    role ? `Target role: ${role}` : 'Target role: (not specified)',
    '',
    `Score A (v${vNumA}): ${result.score_a}`,
    `Score B (v${vNumB}): ${result.score_b}`,
    `Recommended: Resume ${result.recommended_id.toUpperCase()} · v${result.recommended_id === 'a' ? vNumA : vNumB}`,
    '',
    'Recommendation',
    result.recommendation_reason,
    '',
    result.diff_summary ? `Summary\n${result.diff_summary}` : '',
    '',
    'What differs',
    ...diffSections.flatMap((section) => {
      const sectionLines = [`${section.label}:`];
      if (section.only_in_a.length) {
        sectionLines.push(`  ${formatOnlyInLabel(nameA, vNumA, sameDocument)}:`);
        section.only_in_a.forEach((item) => sectionLines.push(`    - ${item}`));
      }
      if (section.only_in_b.length) {
        sectionLines.push(`  ${formatOnlyInLabel(nameB, vNumB, sameDocument)}:`);
        section.only_in_b.forEach((item) => sectionLines.push(`    - ${item}`));
      }
      section.changed.forEach((row) => {
        sectionLines.push(`  Rewritten (${row.label}):`);
        sectionLines.push(`    A: ${row.before}`);
        sectionLines.push(`    B: ${row.after}`);
      });
      return sectionLines;
    }),
  ].filter(Boolean);

  return lines.join('\n');
}

export function downloadCompareReport(state: CompareResultState): void {
  const text = buildCompareReportText(state);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const vA = state.result.version_a_number ?? state.selectionA.version.version_number;
  const vB = state.result.version_b_number ?? state.selectionB.version.version_number;
  anchor.href = url;
  anchor.download = `vetta-compare-v${vA}-vs-v${vB}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}
