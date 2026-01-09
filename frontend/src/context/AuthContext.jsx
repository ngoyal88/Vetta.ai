import React, { useContext, createContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  reload
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const signin = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  const sendVerification = async () => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshUser = async () => {
    if (!auth.currentUser) return null;
    await reload(auth.currentUser);
    setCurrentUser(auth.currentUser);
    return auth.currentUser;
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const updateProfileInfo = async ({ displayName, photoURL }) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await updateProfile(auth.currentUser, { displayName, photoURL });
    await refreshUser();
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await deleteUser(auth.currentUser);
  };

  return (
    <AuthContext.Provider value={{ currentUser, signup, signin, logout, sendVerification, refreshUser, resetPassword, updateProfileInfo, deleteAccount }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
