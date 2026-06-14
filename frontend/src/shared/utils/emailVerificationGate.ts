/** When false, unverified users may access private routes (local dev only). */
export function isEmailVerificationRequired(): boolean {
  return import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION !== 'false';
}

export function isUserEmailVerified(user: { emailVerified?: boolean } | null | undefined): boolean {
  return Boolean(user?.emailVerified);
}
