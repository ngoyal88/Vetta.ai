import { useState } from 'react';
import { useAuth } from 'shared/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from 'firebaseConfig';
import { motion } from 'framer-motion';
import { ArrowRight, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

const formatAuthError = (err) => {
  const code = err?.code;
  if (code === 'auth/popup-blocked') return 'Popup blocked. Allow popups and try again.';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in was cancelled.';
  if (code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  return 'Failed to sign in with Google.';
};

const AuthPreviewPanel = () => (
  <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 bg-raised border-r border-[var(--border-subtle)]">
    <div className="w-full max-w-sm space-y-6">
      <div className="flex items-end justify-center gap-1 h-20">
        {[0.4, 0.6, 0.8, 0.5, 0.7, 0.5, 0.6].map((h, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-cyan-500/80"
            animate={{ height: [`${h * 40}px`, `${(1 - h * 0.3) * 40}px`, `${h * 40}px`] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <div className="space-y-2">
        {['Tell me about a time you led a project.', 'How would you approach this system?'].map((line, i) => (
          <motion.p
            key={i}
            className="text-sm text-zinc-500 font-mono"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.2, duration: 0.3 }}
          >
            {line}
          </motion.p>
        ))}
      </div>
    </div>
  </div>
);

const SignUp = () => {
  const { signup, signInWithGoogle, sendVerification } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':",.<>/?]).{8,}$/;
    if (!strong.test(password)) {
      setError('Password must be 8+ chars with upper, lower, number, and symbol');
      setLoading(false);
      return;
    }
    try {
      const userCredential = await signup(email, password);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), { name, email, createdAt: serverTimestamp() });
      await sendVerification();
      toast.success('Account created! Verification email sent.');
      navigate('/signin');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Email is already in use');
      else setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      const user = result.user;
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          { name: user.displayName || 'New User', email: user.email, createdAt: serverTimestamp() },
          { merge: true }
        );
      } catch (profileErr) {
        console.warn('Profile write failed:', profileErr?.code || profileErr, profileErr);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-base">
      <AuthPreviewPanel />
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <h2 className="text-2xl font-semibold text-white mb-1">Create account</h2>
          <p className="text-zinc-500 text-sm mb-8">Start your interview prep</p>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <LogIn size={18} />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="text-zinc-600 text-xs">or</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full h-10 btn-cyan flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
              {!loading && <ArrowRight size={16} />}
            </motion.button>
          </form>

          <p className="text-center text-zinc-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/signin" className="text-cyan-400 hover:text-cyan-300 font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SignUp;
