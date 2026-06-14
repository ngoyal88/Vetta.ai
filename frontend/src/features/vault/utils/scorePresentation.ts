import type { VaultEntry } from '../types';

export type VaultScoreTier = 'excellent' | 'good' | 'fair' | 'none';

export function normalizeVaultScore(value?: number | null): number | null {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  if (num <= 10) return Math.round(num * 10);
  return Math.round(Math.min(100, Math.max(0, num)));
}

function latestScoreFromHistory(entry: VaultEntry): number | null {
  const history = entry.score_history;
  if (!history?.length) return null;
  const latest = history[history.length - 1];
  return normalizeVaultScore(latest?.score ?? null);
}

export function getVaultEntryScore(entry: VaultEntry): number | null {
  return (
    normalizeVaultScore(entry.scorecard?.score ?? null) ??
    latestScoreFromHistory(entry) ??
    normalizeVaultScore(entry.avg_interview_score ?? null)
  );
}

export function mergeVaultEntryScores(previous: VaultEntry | undefined, incoming: VaultEntry): VaultEntry {
  if (!previous) return incoming;
  if (getVaultEntryScore(incoming) != null) return incoming;

  const preservedScore = getVaultEntryScore(previous);
  if (preservedScore == null) return incoming;

  return {
    ...incoming,
    scorecard: incoming.scorecard ?? previous.scorecard ?? null,
    score_history:
      incoming.score_history?.length ? incoming.score_history : previous.score_history ?? [],
  };
}

export function mergeVaultEntryLists(previous: VaultEntry[], incoming: VaultEntry[]): VaultEntry[] {
  const previousById = new Map(previous.map((entry) => [entry.id, entry]));
  return incoming.map((entry) => mergeVaultEntryScores(previousById.get(entry.id), entry));
}

export function getVaultScoreTier(score: number | null): VaultScoreTier {
  if (score == null) return 'none';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  return 'fair';
}

export function getVaultScoreLabel(tier: VaultScoreTier): string {
  switch (tier) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    default:
      return 'Not scored';
  }
}

export function getVaultScoreRingClass(tier: VaultScoreTier): string {
  switch (tier) {
    case 'excellent':
      return 'text-[var(--color-tertiary)]';
    case 'good':
      return 'text-[var(--color-secondary)]';
    default:
      return 'text-[var(--color-outline)]';
  }
}

export function formatVersionLabel(versionCount: number): string {
  const safeCount = versionCount > 0 ? versionCount : 1;
  return `v${safeCount}`;
}
