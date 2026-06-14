import React, { useState } from 'react';
import type { User } from 'firebase/auth';

import Modal from 'shared/components/Modal';
import { AuthSocialButton } from 'features/auth/components/AuthSocialButton';
import { GoogleLogo } from 'features/auth/components/icons/GoogleLogo';
import { hasPasswordProvider } from '../../utils/settingsUtils';

const CONFIRMATION_TEXT = 'DELETE';

type DeleteAccountModalProps = {
  open: boolean;
  user: User;
  deleting: boolean;
  onClose: () => void;
  onConfirm: (options: { password?: string; useGoogle: boolean }) => Promise<void>;
};

export function DeleteAccountModal({
  open,
  user,
  deleting,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const passwordSignIn = hasPasswordProvider(user);
  const canSubmit = confirmation === CONFIRMATION_TEXT && !deleting;

  const reset = () => {
    setConfirmation('');
    setPassword('');
    setError('');
  };

  const handleClose = () => {
    if (deleting) return;
    reset();
    onClose();
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    if (passwordSignIn && !password.trim()) {
      setError('Enter your password to confirm deletion.');
      return;
    }
    setError('');
    try {
      await onConfirm({ password: password.trim(), useGoogle: false });
      reset();
    } catch {
      setError('Could not delete account. Check your password and try again.');
    }
  };

  const handleGoogleConfirm = async () => {
    if (!canSubmit) return;
    setError('');
    try {
      await onConfirm({ useGoogle: true });
      reset();
    } catch {
      setError('Google confirmation failed. Try again.');
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Delete account">
      <p className="mb-4 text-sm text-[var(--color-on-surface-variant)]">
        This permanently removes interview history, vault files, profile claims, and your sign-in record.
        Type <strong>{CONFIRMATION_TEXT}</strong> to confirm.
      </p>

      <label className="mb-2 block type-label-sm text-[var(--color-on-surface-variant)]" htmlFor="delete-confirm">
        Confirmation
      </label>
      <input
        id="delete-confirm"
        type="text"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="settings-input mb-4 w-full"
        placeholder={CONFIRMATION_TEXT}
        autoComplete="off"
        disabled={deleting}
      />

      {passwordSignIn ? (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block type-label-sm text-[var(--color-on-surface-variant)]" htmlFor="delete-password">
              Password
            </label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="settings-input w-full"
              autoComplete="current-password"
              disabled={deleting}
            />
          </div>
          {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" className="settings-btn" onClick={handleClose} disabled={deleting}>
              Cancel
            </button>
            <button
              type="submit"
              className="settings-btn settings-btn--danger"
              disabled={!canSubmit || deleting}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <AuthSocialButton
            icon={<GoogleLogo />}
            label="Confirm with Google"
            onClick={handleGoogleConfirm}
            disabled={!canSubmit || deleting}
          />
          {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
          <div className="flex justify-end">
            <button type="button" className="settings-btn" onClick={handleClose} disabled={deleting}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
