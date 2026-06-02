import type { ResumeProfile, VaultEntry, VaultScorecard, VaultVersion } from 'features/vault/types';

import { SCAN_DEPTH_STOPS } from '../constants/resumeDeepDiveOptions';

export { resumeDisplayName } from '../../shared/utils/resumeDisplayName';

export function formatVaultDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return null;
}

export function estimateDataIntegrity(
  profile: ResumeProfile | null,
  scorecard?: VaultScorecard | null,
): number {
  if (scorecard?.score != null && Number.isFinite(scorecard.score)) {
    return Math.round(Math.min(100, Math.max(0, scorecard.score)));
  }
  if (!profile) return 0;
  let points = 0;
  if ((profile.work_experience?.length ?? 0) > 0) points += 35;
  if ((profile.projects?.length ?? 0) > 0) points += 25;
  if (profile.skills) points += 20;
  if (profile.summary) points += 10;
  if ((profile.education?.length ?? 0) > 0) points += 10;
  return Math.min(98, Math.max(35, points));
}

export function getScanDepthStop(value: number) {
  return SCAN_DEPTH_STOPS.find((stop) => stop.value === value) ?? SCAN_DEPTH_STOPS[2];
}

export function documentFileLabel(
  version: VaultVersion | null,
  entry: Pick<VaultEntry, 'name'> | null,
): string {
  if (version?.source_filename?.trim()) return version.source_filename.trim();
  if (entry?.name?.trim()) return `${entry.name.trim()}.pdf`;
  return 'Active resume.pdf';
}

export function documentMetaLine(version: VaultVersion | null): string {
  return version?.content_type?.includes('pdf') ? 'PDF Document' : 'Resume document';
}

export function isPdfVersion(version: VaultVersion | null, filename: string): boolean {
  return Boolean(
    version?.content_type?.includes('pdf') || filename.toLowerCase().endsWith('.pdf'),
  );
}

export function roleProjectSummary(profile: ResumeProfile | null): string | null {
  if (!profile) return null;
  const roles = profile.work_experience?.length ?? 0;
  const projects = profile.projects?.length ?? 0;
  return `${roles} roles · ${projects} projects`;
}
