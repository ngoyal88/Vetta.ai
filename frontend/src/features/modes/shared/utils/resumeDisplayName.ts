import type { ResumeProfile } from 'features/vault/types';

export function resumeDisplayName(profile: ResumeProfile | null): string | null {
  if (!profile) return null;
  if (typeof profile.name === 'string' && profile.name.trim()) return profile.name.trim();
  if (profile.name && typeof profile.name === 'object' && 'raw' in profile.name) {
    const raw = profile.name.raw;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}
