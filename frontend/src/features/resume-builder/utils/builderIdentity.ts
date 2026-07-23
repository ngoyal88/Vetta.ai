import type { ResumeProfile } from 'features/vault/types/domain';

export type BuilderIdentity = {
  name: string;
  email: string;
};

export function isValidIdentityEmail(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function resolveBuilderIdentity(
  settingsDoc: { name?: string; email?: string } | null,
  currentUser: { displayName?: string | null; email?: string | null } | null,
): BuilderIdentity | null {
  const name = settingsDoc?.name?.trim() || currentUser?.displayName?.trim() || '';
  const settingsEmail = settingsDoc?.email?.trim() || '';
  const authEmail = currentUser?.email?.trim() || '';
  const email = isValidIdentityEmail(settingsEmail) ? settingsEmail : authEmail;

  return name || email ? { name, email } : null;
}

export function buildInitialProfile(identity: BuilderIdentity): ResumeProfile {
  return {
    name: identity.name,
    contact: {
      email: identity.email,
      phone: '',
      location: '',
      links: { github: '', linkedin: '', portfolio: '', other: [] },
    },
    summary: '',
  };
}

export function isProfileReady(identity: BuilderIdentity | null): boolean {
  return Boolean(identity?.name.trim() && identity?.email.trim());
}
