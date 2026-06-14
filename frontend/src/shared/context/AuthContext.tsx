import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
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
  /** False until Firebase emits the first auth state (including restored sessions). */
  authReady: boolean;
  signup: (email: string, password: string) => Promise<UserCredential>;
  signin: (email: string, password: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  logout: () => Promise<void>;
  sendVerification: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileInfo: (input: UpdateProfileInput) => Promise<void>;
  deleteAccount: () => Promise<void>;
  reauthenticateWithPassword: (email: string, password: string) => Promise<void>;
  reauthenticateWithGoogle: () => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState(() => Boolean(auth.currentUser));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
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

  const reauthenticateWithPassword = useCallback(async (email: string, password: string) => {
    if (!auth.currentUser) throw new Error("Not signed in");
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  }, []);

  const reauthenticateWithGoogle = useCallback(async () => {
    if (!auth.currentUser) throw new Error("Not signed in");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "login" });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential) throw new Error("Google re-authentication failed");
    await reauthenticateWithCredential(auth.currentUser, credential);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      authReady,
      signup,
      signin,
      signInWithGoogle,
      logout,
      sendVerification,
      refreshUser,
      resetPassword,
      updateProfileInfo,
      deleteAccount,
      reauthenticateWithPassword,
      reauthenticateWithGoogle,
    }),
    [currentUser, authReady, signup, signin, signInWithGoogle, logout, sendVerification, refreshUser, resetPassword, updateProfileInfo, deleteAccount, reauthenticateWithPassword, reauthenticateWithGoogle],
  );

  return (
    <AuthContext.Provider value={value}>
      {!authReady ? (
        <div
          className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg-0)]/80 backdrop-blur-[2px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--teal-1)] border-t-transparent" />
            <p className="text-sm text-[var(--cream-3)]">Checking auth…</p>
          </div>
        </div>
      ) : null}
      {children}
    </AuthContext.Provider>
  );
};
