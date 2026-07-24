import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from 'shared/context/AuthContext';
import { queryKeys } from 'shared/query/queryKeys';
import { api } from 'shared/services/api';
import { getSkipPrecheck, setSkipPrecheck } from 'features/interview/preflight/precheckStorage';
import { persistUserSettings } from '../services/userSettingsService';
import { useUserSettingsQuery } from '../queries/useUserSettingsQuery';

export function useSettingsPage() {
  const {
    currentUser,
    sendVerification,
    resetPassword,
    updateProfileInfo,
    deleteAccount,
    refreshUser,
    reauthenticateWithPassword,
    reauthenticateWithGoogle,
  } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings: settingsDoc, loading: settingsLoading } = useUserSettingsQuery();

  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [defaultRole, setDefaultRole] = useState('');
  const [defaultYoe, setDefaultYoe] = useState(0);
  const [skipPrecheck, setSkipPrecheckState] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setInitialized(true);
      return;
    }
    if (settingsLoading) return;

    setDisplayName(settingsDoc?.name || currentUser.displayName || '');
    setPhotoUrl(currentUser.photoURL || settingsDoc?.photoURL || '');
    setDefaultRole(settingsDoc?.defaults?.targetRole || '');
    setDefaultYoe(
      typeof settingsDoc?.defaults?.yearsExperience === 'number' ? settingsDoc.defaults.yearsExperience : 0,
    );
    setSkipPrecheckState(getSkipPrecheck());
    setInitialized(true);
  }, [currentUser, settingsDoc, settingsLoading]);

  const loading = !initialized || settingsLoading;

  const setSkipPrecheckPreference = (value: boolean) => {
    setSkipPrecheck(value);
    setSkipPrecheckState(value);
  };

  const saveSettings = useCallback(async () => {
    if (!currentUser) {
      toast.error('Please sign in again');
      return;
    }

    setSaving(true);
    try {
      const trimmedName = displayName.trim();
      const trimmedPhoto = photoUrl.trim();
      const trimmedRole = defaultRole.trim();
      const yoe = Math.max(0, Math.min(50, defaultYoe));

      await updateProfileInfo({
        displayName: trimmedName || undefined,
        photoURL: trimmedPhoto || undefined,
      });

      await persistUserSettings(currentUser.uid, {
        name: trimmedName || undefined,
        email: currentUser.email || undefined,
        photoURL: trimmedPhoto || undefined,
        defaults: {
          targetRole: trimmedRole || undefined,
          yearsExperience: yoe > 0 ? yoe : undefined,
        },
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.user.settings(currentUser.uid) });
      await refreshUser();
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [currentUser, defaultRole, defaultYoe, displayName, photoUrl, queryClient, refreshUser, updateProfileInfo]);

  const handleSendVerification = useCallback(async () => {
    setSendingVerification(true);
    try {
      await sendVerification();
      toast.success('Verification email sent');
    } catch {
      toast.error('Failed to send verification email');
    } finally {
      setSendingVerification(false);
    }
  }, [sendVerification]);

  const handleResetPassword = useCallback(async () => {
    if (!currentUser?.email) {
      toast.error('No email on account');
      return;
    }
    setSendingReset(true);
    try {
      await resetPassword(currentUser.email);
      toast.success('Password reset email sent');
    } catch {
      toast.error('Failed to send reset email');
    } finally {
      setSendingReset(false);
    }
  }, [currentUser?.email, resetPassword]);

  const handleDeleteAccount = useCallback(
    async (options: { password?: string; useGoogle: boolean }) => {
      if (!currentUser) {
        toast.error('Please sign in again');
        return;
      }

      setDeleting(true);
      try {
        if (options.useGoogle) {
          await reauthenticateWithGoogle();
        } else if (options.password && currentUser.email) {
          await reauthenticateWithPassword(currentUser.email, options.password);
        } else {
          throw new Error('Re-authentication required');
        }

        await api.deleteAccountData();
        await deleteAccount();
        toast.success('Account deleted');
        navigate('/');
      } catch {
        toast.error('Failed to delete account');
        throw new Error('delete failed');
      } finally {
        setDeleting(false);
      }
    },
    [
      currentUser,
      deleteAccount,
      navigate,
      reauthenticateWithGoogle,
      reauthenticateWithPassword,
    ],
  );

  return {
    currentUser,
    loading,
    displayName,
    setDisplayName,
    photoUrl,
    setPhotoUrl,
    defaultRole,
    setDefaultRole,
    defaultYoe,
    setDefaultYoe,
    skipPrecheck,
    setSkipPrecheckPreference,
    saving,
    deleting,
    sendingVerification,
    sendingReset,
    saveSettings,
    handleSendVerification,
    handleResetPassword,
    handleDeleteAccount,
  };
}
