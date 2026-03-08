import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Mail, Lock, ArrowRight, LogIn } from "lucide-react";
import toast from "react-hot-toast";

const formatAuthError = (err) => {
  const code = err?.code;
  if (code === 'auth/popup-blocked') {
    return 'Popup blocked by the browser. Allow popups for this site and try again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Popup was closed before completing sign-in. Please try again.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Sign-in was cancelled. Please try again.';
  }
  return 'Failed to sign in with Google.';
};

const SignIn = () => {
  const { signin, resetPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""); 
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      await signin(email, password); 
      navigate("/dashboard");
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setError("Enter your email first");
      return;
    }
    
    try {
      await resetPassword(email);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError("Failed to send reset email");
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithGoogle();
      const user = result.user;
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            name: user.displayName || "User",
            email: user.email,
            lastLoginAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (profileErr) {
        // Don't block sign-in if Firestore rules are misconfigured.
        console.warn('Profile write failed after Google sign-in:', profileErr?.code || profileErr, profileErr);
      }
      navigate("/dashboard");
    } catch (err) {
      console.error('Google sign-in error:', err?.code || err, err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-20">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="signin-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#06b6d4" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#signin-grid)" />
        </svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-w-md w-full bg-gray-900/80 backdrop-blur-lg border border-cyan-600/20 rounded-2xl p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400">Sign in to continue your interview prep</p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Google Sign In (Top) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn size={18} />
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-cyan-600/20"></div>
          <span className="px-4 text-gray-500 text-sm">or</span>
          <div className="flex-1 border-t border-cyan-600/20"></div>
        </div>

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-600/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                placeholder="your@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-600/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition"
            >
              Forgot password?
            </button>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full btn-cyan flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing In..." : "Sign In"}
            {!loading && <ArrowRight size={20} />}
          </motion.button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center">
          <p className="text-gray-400 text-sm">
            Don't have an account?{" "}
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 font-medium transition">
              Sign Up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignIn;