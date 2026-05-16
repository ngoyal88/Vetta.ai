import type { TimestampLike } from '../types';

export const MAX_RESUMES = 5;
export const MAX_VERSIONS = 5;
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_FILE_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export function normalizeTagInput(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function validateResumeFile(file: File | null): string | null {
  if (!file) return 'Select a file first';

  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  if (!extension || !ALLOWED_FILE_EXTENSIONS.has(extension)) {
    return 'Unsupported file type. Allowed: PDF, DOCX, TXT.';
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return 'File too large. Max size 5 MB.';
  }

  return null;
}

function toDate(value: TimestampLike | undefined): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && value && 'seconds' in value && typeof value.seconds === 'number') {
    const millis = value.seconds * 1000 + Math.floor((value.nanos ?? 0) / 1_000_000);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatTimestamp(value: TimestampLike | undefined): string {
  const date = toDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleString();
}

export function formatShortDate(value: TimestampLike | undefined): string {
  const date = toDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatCoverageCounts(coverageCounts?: Record<string, number> | null): string {
  if (!coverageCounts) return 'Not available';

  const parts = Object.entries(coverageCounts)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);

  return parts.length ? parts.join(' | ') : 'Not available';
}
