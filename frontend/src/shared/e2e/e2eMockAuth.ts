import type { User } from 'firebase/auth';

/** Dev-only Playwright bypass — never active in production builds. */
export function isE2EMockAuthEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_E2E_MOCK_AUTH === 'true';
}

export async function getE2EAuthHeaders(isForm = false): Promise<Record<string, string> | null> {
  if (!isE2EMockAuthEnabled()) return null;
  const base = { Authorization: 'Bearer e2e-mock-token' };
  return isForm ? base : { 'Content-Type': 'application/json', ...base };
}

export function createE2EMockUser(): User {
  return {
    uid: 'playwright-e2e-user',
    email: 'e2e@vetta.test',
    emailVerified: true,
    displayName: 'E2E User',
    getIdToken: async () => 'e2e-mock-token',
  } as User;
}

export type VettaE2EWindow = Window & {
  __VETTA_E2E__?: {
    invalidateAfterInterview: () => Promise<void>;
  };
};
