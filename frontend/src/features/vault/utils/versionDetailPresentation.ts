import type { CSSProperties } from 'react';

import type { TimestampLike, VaultEntry, VaultScorecard, VaultVersion } from '../types';
import { normalizeVaultScore } from './scorePresentation';

export type CoverageBar = {
  key: string;
  label: string;
  percent: number;
  tone: 'tertiary' | 'primary' | 'secondary';
};

export type SuggestionCard = {
  title: string;
  body: string;
  keywords?: string[];
};

function toPercent(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (value / cap) * 100)));
}

export function getVersionDisplayScore(
  entry: VaultEntry | null | undefined,
  version: VaultVersion | null | undefined,
  scorecard: VaultScorecard | null | undefined,
): number | null {
  if (scorecard?.score != null) {
    return normalizeVaultScore(scorecard.score);
  }
  if (entry?.current_version_id === version?.id && entry.scorecard?.score != null) {
    return normalizeVaultScore(entry.scorecard.score);
  }
  return normalizeVaultScore(version?.score_at_version ?? version?.latest_score ?? null);
}

export function buildCoverageBars(
  coverageCounts?: Record<string, number> | null,
): CoverageBar[] {
  const skills = coverageCounts?.skills ?? 0;
  const projects = coverageCounts?.projects ?? 0;
  const experience = coverageCounts?.work_experiences ?? coverageCounts?.workExperiences ?? 0;

  return [
    {
      key: 'skills',
      label: 'Hard Skills Identified',
      percent: toPercent(skills, 12),
      tone: 'tertiary',
    },
    {
      key: 'projects',
      label: 'Project Depth',
      percent: toPercent(projects, 3),
      tone: 'primary',
    },
    {
      key: 'experience',
      label: 'Experience Depth',
      percent: toPercent(experience, 2),
      tone: 'secondary',
    },
  ];
}

export function buildSuggestionCards(
  suggestions: string[] | undefined,
  weakAreas: string[] | undefined,
): SuggestionCard[] {
  const cards: SuggestionCard[] = [];

  for (const suggestion of suggestions ?? []) {
    const trimmed = suggestion.trim();
    if (!trimmed) continue;
    const sentenceBreak = trimmed.indexOf('. ');
    if (sentenceBreak > 0 && sentenceBreak < 48) {
      cards.push({
        title: trimmed.slice(0, sentenceBreak),
        body: trimmed.slice(sentenceBreak + 2),
      });
    } else {
      cards.push({ title: 'Suggestion', body: trimmed });
    }
  }

  if (weakAreas?.length) {
    cards.push({
      title: 'Missing Keywords',
      body: 'Consider adding these role-relevant terms where they truthfully apply.',
      keywords: weakAreas.slice(0, 8),
    });
  }

  return cards;
}

function toDate(value: TimestampLike | undefined): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && value && 'seconds' in value) {
    const millis = value.seconds * 1000 + Math.floor((value.nanos ?? 0) / 1_000_000);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatLastAnalyzedLabel(value: TimestampLike | undefined): string {
  const date = toDate(value);
  if (!date) return 'Not analyzed yet';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 1) return 'Last analyzed just now';
  if (diffMinutes < 60) return `Last analyzed ${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Last analyzed ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 14) return `Last analyzed ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return `Last analyzed on ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function formatFileSize(bytes?: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getScoreGaugeStyle(score: number | null): CSSProperties {
  const safe = score ?? 0;
  const fill = Math.min(100, Math.max(0, safe));
  return {
    background: `conic-gradient(from 180deg, var(--color-tertiary) 0%, var(--color-primary-container) ${fill}%, color-mix(in srgb, var(--color-on-surface) 8%, transparent) ${fill}%, color-mix(in srgb, var(--color-on-surface) 8%, transparent) 100%)`,
  };
}
