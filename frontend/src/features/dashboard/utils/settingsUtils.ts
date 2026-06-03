import type { User } from 'firebase/auth';

export function userInitials(user: User | null, fallbackName = ''): string {
  const name = fallbackName.trim() || user?.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = user?.email?.split('@')[0] ?? '?';
  return local.slice(0, 2).toUpperCase();
}

export function signInMethodLabel(user: User | null): string {
  if (!user?.providerData.length) return 'Unknown';
  const ids = user.providerData.map((provider) => provider.providerId);
  if (ids.includes('google.com')) return 'Google';
  if (ids.includes('password')) return 'Email & password';
  const raw = ids[0]?.replace('.com', '') ?? 'Unknown';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function hasPasswordProvider(user: User | null): boolean {
  return Boolean(user?.providerData.some((provider) => provider.providerId === 'password'));
}
