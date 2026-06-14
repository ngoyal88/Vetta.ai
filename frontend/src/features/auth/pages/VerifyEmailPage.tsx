import { useState } from 'react';
import { Hexagon, Mail } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import { AuthBrandLink } from '../components/AuthBrandLink';
import { AuthShowcasePanel } from '../components/AuthShowcasePanel';
import { useAuth } from 'shared/context/AuthContext';
import { getPostAuthRedirectPath } from 'shared/utils/getPostAuthRedirectPath';
import { isUserEmailVerified } from 'shared/utils/emailVerificationGate';

export default function VerifyEmailPage() {
  const { currentUser, authReady, sendVerification, refreshUser, logout } = useAuth();
  const location = useLocation();
  const redirectTo = getPostAuthRedirectPath(location.state);

  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!authReady) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  if (isUserEmailVerified(currentUser)) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      await sendVerification();
      toast.success('Verification email sent. Check your inbox.');
    } catch {
      toast.error('Failed to send verification email');
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const user = await refreshUser();
      if (user && isUserEmailVerified(user)) {
        toast.success('Email verified');
      } else {
        toast.error('Email not verified yet. Check your inbox and try again.');
      }
    } catch {
      toast.error('Could not refresh verification status');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <main className="auth-shell flex flex-col bg-[var(--color-background)] text-[var(--color-on-surface)] selection:bg-[var(--color-primary-container)]/30 lg:flex-row">
      <section className="auth-shell__scroll relative z-10 flex w-full flex-col justify-center px-8 py-12 sm:px-16 lg:w-1/2 lg:px-24">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8 py-6">
          <AuthBrandLink
            icon={
              <Hexagon
                className="h-8 w-8 text-[var(--color-primary)]"
                strokeWidth={1.75}
                fill="currentColor"
                fillOpacity={0.15}
                aria-hidden="true"
              />
            }
            labelClassName="type-headline-md tracking-tight text-[var(--color-primary)]"
          />

          <div className="flex flex-col gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-container)]/20 text-[var(--color-primary)]">
              <Mail className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h1 className="type-headline-lg tracking-tight">Verify your email</h1>
            <p className="type-body-md text-[var(--color-on-surface-variant)]">
              We sent a verification link to{' '}
              <span className="font-medium text-[var(--color-on-surface)]">{currentUser.email}</span>.
              Confirm your email to access your account.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="auth-submit-btn w-full"
              disabled={sending}
              onClick={handleResend}
            >
              {sending ? 'Sending…' : 'Resend verification email'}
            </button>
            <button
              type="button"
              className="auth-social-btn auth-social-btn--outline w-full"
              disabled={refreshing}
              onClick={handleRefresh}
            >
              {refreshing ? 'Checking…' : "I've verified — refresh"}
            </button>
            <button
              type="button"
              className="type-label-md text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)]"
              onClick={() => logout()}
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      <AuthShowcasePanel />
    </main>
  );
}
