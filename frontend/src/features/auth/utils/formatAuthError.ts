type FirebaseAuthError = {
  code?: string;
  message?: string;
};

export function formatAuthError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = (err as FirebaseAuthError)?.code;
  if (code === 'auth/popup-blocked') return 'Popup blocked. Allow popups and try again.';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in was cancelled.';
  if (code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  if (code === 'auth/email-already-in-use') {
    return 'Could not create account. Try signing in or use a different email.';
  }
  return fallback;
}
