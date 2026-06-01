import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Hexagon } from 'lucide-react';
import toast from 'react-hot-toast';

import { db } from 'firebaseConfig';
import { useAuth } from 'shared/context/AuthContext';
import { getPostAuthRedirectPath } from 'shared/utils/getPostAuthRedirectPath';

import { AuthBrandLink } from '../components/AuthBrandLink';
import { AuthPlainField } from '../components/AuthPlainField';
import { AuthShowcasePanel } from '../components/AuthShowcasePanel';
import { AuthSocialButton } from '../components/AuthSocialButton';
import { GoogleLogo } from '../components/icons/GoogleLogo';
import { formatAuthError } from '../utils/formatAuthError';

export default function SignIn() {
  const { signin, resetPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = getPostAuthRedirectPath(location.state);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signin(email, password);
      navigate(redirectTo, { replace: true });
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your email first');
      return;
    }
    setError('');
    try {
      await resetPassword(email);
      toast.success('Password reset email sent. Check your inbox.');
    } catch {
      setError('Failed to send reset email');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      const user = result.user;
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            name: user.displayName || 'User',
            email: user.email,
            lastLoginAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        /* profile write is best-effort */
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(formatAuthError(err, 'Failed to sign in with Google.'));
    } finally {
      setLoading(false);
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
            <h1 className="type-headline-lg tracking-tight">Sign In</h1>
            <p className="type-body-md text-[var(--color-on-surface-variant)]">
              Enter your details to access your command center.
            </p>
          </div>

          {error ? (
            <div
              className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error-container)]/20 px-4 py-3 type-body-md text-[var(--color-error)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-6">
            <AuthSocialButton
              icon={<GoogleLogo />}
              label="Sign in with Google"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="auth-social-btn--outline"
            />

            <div className="auth-divider">
              <span>Or continue with email</span>
            </div>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
              <AuthPlainField
                id="email"
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <AuthPlainField
                id="password"
                name="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                labelAction={
                  <button
                    type="button"
                    onClick={handleReset}
                    className="type-label-sm text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-fixed)]"
                  >
                    Forgot Password?
                  </button>
                }
              />

              <button type="submit" className="auth-submit-btn mt-2 w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center type-body-md text-[var(--color-on-surface-variant)]">
              Don&apos;t have an account?{' '}
              <Link
                to="/signup"
                className="type-label-md text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-fixed)]"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </section>

      <AuthShowcasePanel />
    </main>
  );
}
