import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth } from "firebaseConfig";

type UpdateProfileInput = {
  displayName?: string | null;
  photoURL?: string | null;
};

type AuthContextValue = {
  currentUser: User | null;
  signup: (email: string, password: string) => Promise<UserCredential>;
  signin: (email: string, password: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  sendVerification: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileInfo: (input: UpdateProfileInput) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

type AuthProviderProps = {
  children: React.ReactNode;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within an AuthProvider");
  return value;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signup = useCallback((email: string, password: string) => createUserWithEmailAndPassword(auth, email, password), []);

  const signin = useCallback((email: string, password: string) => signInWithEmailAndPassword(auth, email, password), []);

  const signInWithGoogle = useCallback(() => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return signInWithPopup(auth, provider);
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  const sendVerification = useCallback(async () => {
    if (!auth.currentUser) throw new Error("Not signed in");
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!auth.currentUser) return null;
    await reload(auth.currentUser);
    setCurrentUser(auth.currentUser);
    return auth.currentUser;
  }, []);

  const resetPassword = useCallback((email: string) => sendPasswordResetEmail(auth, email), []);

  const updateProfileInfo = useCallback(async ({ displayName, photoURL }: UpdateProfileInput) => {
    if (!auth.currentUser) throw new Error("Not signed in");
    await updateProfile(auth.currentUser, { displayName, photoURL });
    await refreshUser();
  }, [refreshUser]);

  const deleteAccount = useCallback(async () => {
    if (!auth.currentUser) throw new Error("Not signed in");
    await deleteUser(auth.currentUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      signup,
      signin,
      signInWithGoogle,
      logout,
      sendVerification,
      refreshUser,
      resetPassword,
      updateProfileInfo,
      deleteAccount,
    }),
    [currentUser, signup, signin, signInWithGoogle, logout, sendVerification, refreshUser, resetPassword, updateProfileInfo, deleteAccount],
  );

  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)]" aria-busy="true" aria-live="polite">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[var(--teal-1)] border-t-transparent" />
            <p className="text-sm text-[var(--cream-3)]">Checking auth...</p>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
