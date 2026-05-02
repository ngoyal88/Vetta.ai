import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Image, Mail, ShieldCheck, User2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useAuth } from 'shared/context/AuthContext';
import { useConfirmDialog } from 'shared/context/ConfirmDialogContext';
import useUserProfile from 'shared/hooks/useUserProfile';
import { api } from 'shared/services/api';
import type { AccountPanelProps } from 'features/dashboard/types/panels';

function AccountSection({
  currentUser,
  profileName,
  setProfileName,
  profilePhoto,
  setProfilePhoto,
  savingProfile,
  setSavingProfile,
  sendVerification,
  resetPassword,
  updateProfileInfo,
  refreshUser,
  deletingAccountState,
  setDeletingAccountState,
  api,
  deleteAccount,
  navigate,
}: AccountPanelProps) {
  const { confirmDialog } = useConfirmDialog();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8 mt-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white">Account & Profile</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="email"
                value={currentUser?.email || ''}
                readOnly
                className="w-full pl-12 pr-4 py-3 bg-black/30 border border-cyan-600/20 rounded-lg text-gray-400 placeholder-gray-500 focus:outline-none"
                placeholder="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Display Name</label>
            <div className="relative">
              <User2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-600/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                placeholder="Your name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Photo URL</label>
            <div className="relative">
              <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="url"
                value={profilePhoto}
                onChange={(e) => setProfilePhoto(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-600/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                placeholder="https://..."
              />
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                setSavingProfile(true);
                await updateProfileInfo({
                  displayName: profileName || undefined,
                  photoURL: profilePhoto || undefined,
                });
                await refreshUser();
                toast.success('Profile updated');
              } catch (err) {
                console.error(err);
                toast.error('Failed to update profile');
              } finally {
                setSavingProfile(false);
              }
            }}
            disabled={savingProfile}
            className="btn-cyan w-full"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                try {
                  await sendVerification();
                  toast.success('Verification email sent');
                } catch (err) {
                  console.error(err);
                  toast.error('Failed to send verification');
                }
              }}
              className="px-4 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg hover:bg-cyan-500/10"
            >
              Send Verification
            </button>

            <button
              onClick={async () => {
                if (!currentUser?.email) {
                  toast.error('No email on account');
                  return;
                }
                try {
                  await resetPassword(currentUser.email);
                  toast.success('Password reset email sent');
                } catch (err) {
                  console.error(err);
                  toast.error('Failed to send reset email');
                }
              }}
              className="px-4 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg hover:bg-cyan-500/10"
            >
              Reset Password
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-2 text-red-300 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">Danger Zone</span>
            </div>
            <p className="text-sm text-gray-300 mb-3">Delete your account and all interview history. This action cannot be undone.</p>
            <button
              onClick={() => {
                confirmDialog({
                  title: 'Delete account',
                  message: 'Delete your account and all interview data? This cannot be undone.',
                  destructive: true,
                  onConfirm: async () => {
                    try {
                      setDeletingAccountState(true);
                      await api.deleteAccountData();
                      await deleteAccount();
                      toast.success('Account deleted');
                      navigate('/');
                    } catch (err) {
                      console.error(err);
                      toast.error('Failed to delete account');
                    } finally {
                      setDeletingAccountState(false);
                    }
                  },
                });
              }}
              disabled={deletingAccountState}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-60"
            >
              {deletingAccountState ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const Profile: React.FC = () => {
  const { currentUser, sendVerification, resetPassword, updateProfileInfo, deleteAccount, refreshUser } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccountState, setDeletingAccountState] = useState(false);

  useEffect(() => {
    setProfileName(profile?.name || currentUser?.displayName || '');
    setProfilePhoto(currentUser?.photoURL || '');
  }, [profile?.name, currentUser]);

  return (
    <div className="min-h-screen bg-base px-5 py-6 pt-16">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Profile</p>
        <AccountSection
          currentUser={currentUser}
          profileName={profileName}
          setProfileName={setProfileName}
          profilePhoto={profilePhoto}
          setProfilePhoto={setProfilePhoto}
          savingProfile={savingProfile}
          setSavingProfile={setSavingProfile}
          sendVerification={sendVerification}
          resetPassword={resetPassword}
          updateProfileInfo={updateProfileInfo}
          refreshUser={refreshUser}
          deletingAccountState={deletingAccountState}
          setDeletingAccountState={setDeletingAccountState}
          api={api}
          deleteAccount={deleteAccount}
          navigate={navigate}
        />
      </div>
    </div>
  );
};

export default Profile;
