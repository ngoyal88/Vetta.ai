import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowRight, Eye, EyeOff, LayoutGrid, Lock, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { db } from 'firebaseConfig';
import { useAuth } from 'shared/context/AuthContext';
import { getPostAuthRedirectPath } from 'shared/utils/getPostAuthRedirectPath';

import { AuthBrandLink } from '../components/AuthBrandLink';
import { AuthBrandPanel } from '../components/AuthBrandPanel';
import { AuthFormField } from '../components/AuthFormField';
import { AuthSocialButton } from '../components/AuthSocialButton';
import { GoogleLogo } from '../components/icons/GoogleLogo';
import { formatAuthError } from '../utils/formatAuthError';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUp() {
  const { signup, signInWithGoogle, sendVerification, updateProfileInfo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = getPostAuthRedirectPath(location.state);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      const user = result.user;
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            name: user.displayName || 'New User',
            email: user.email,
            createdAt: serverTimestamp(),
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signup(email, password);
      const user = userCredential.user;

      if (name.trim()) {
        await updateProfileInfo({ displayName: name.trim() });
      }

      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim() || 'New User',
        email,
        createdAt: serverTimestamp(),
      });

      await sendVerification();
      toast.success('Account created! Check your email to verify.');
      navigate('/signin');
    } catch (err) {
      setError(formatAuthError(err, 'Failed to create account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell auth-shell--signup flex bg-[var(--color-background)] text-[var(--color-on-surface)] selection:bg-[var(--color-primary)]/30 selection:text-[var(--color-primary)]">
      <AuthBrandPanel />

      <div className="auth-signup-panel relative flex w-full lg:w-1/2 items-center justify-center">
        <div className="auth-signup-form">
          <AuthBrandLink
            icon={
              <LayoutGrid
                className="h-7 w-7 text-[var(--color-primary)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            }
            className="auth-signup-form__mobile-brand lg:hidden"
            labelClassName="type-headline-md text-[var(--color-on-surface)]"
          />

          <div className="auth-signup-form__header text-center lg:text-left">
            <h2 className="type-headline-lg mb-2">Get Started</h2>
            <p className="type-body-md text-[var(--color-on-surface-variant)]">
              Create your account to deploy your agent.
            </p>
          </div>

          {error ? (
            <div
              className="auth-signup-form__error rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error-container)]/20 px-3 py-2 type-body-md text-[var(--color-error)]"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <AuthSocialButton
            icon={<GoogleLogo />}
            label="Continue with Google"
            onClick={handleGoogleSignUp}
            disabled={loading}
          />

          <div className="auth-divider auth-signup-form__divider">
            <span>Or register with email</span>
          </div>

          <form className="auth-signup-form__fields" onSubmit={handleSubmit} noValidate>
            <AuthFormField
              id="name"
              name="name"
              label="Full Name"
              type="text"
              autoComplete="name"
              placeholder="Alex Chen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={<User className="h-5 w-5" strokeWidth={1.75} />}
              required
            />

            <AuthFormField
              id="email"
              name="email"
              label="Professional Email"
              type="email"
              autoComplete="email"
              placeholder="alex.chen@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-5 w-5" strokeWidth={1.75} />}
              required
            />

            <AuthFormField
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
              suffix={
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-outline)] transition-colors hover:text-[var(--color-on-surface)]"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.75} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </button>
              }
              required
              minLength={MIN_PASSWORD_LENGTH}
            />

            <button type="submit" className="auth-submit-btn auth-signup-form__submit group w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Initialize Profile'}
              {!loading ? (
                <ArrowRight
                  className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </form>

          <p className="auth-signup-form__footer text-center type-body-md text-[var(--color-on-surface-variant)]">
            Already have an account?{' '}
            <Link
              to="/signin"
              className="type-label-md text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-fixed)] hover:underline"
            >
              Sign In
            </Link>
          </p>

          <p className="auth-signup-form__legal text-center type-label-sm text-[var(--color-outline)]/80">
            By registering, you agree to our{' '}
            <Link to="/" className="transition-colors hover:text-[var(--color-outline)]">
              Terms
            </Link>{' '}
            and{' '}
            <Link
              to={{ pathname: '/', hash: '#privacy' }}
              className="transition-colors hover:text-[var(--color-outline)]"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
