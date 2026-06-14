import React, { useState } from 'react';
import { BadgeCheck, Mail, UserRound } from 'lucide-react';
import type { User } from 'firebase/auth';

import { SettingsSection } from './SettingsSection';
import { hasPasswordProvider, signInMethodLabel, userInitials } from '../../utils/settingsUtils';

type SettingsIdentitySectionProps = {
  user: User;
  displayName: string;
  photoUrl: string;
  saving: boolean;
  sendingVerification: boolean;
  sendingReset: boolean;
  onDisplayNameChange: (value: string) => void;
  onPhotoUrlChange: (value: string) => void;
  onSave: () => void;
  onSendVerification: () => void;
  onResetPassword: () => void;
};

export function SettingsIdentitySection({
  user,
  displayName,
  photoUrl,
  saving,
  sendingVerification,
  sendingReset,
  onDisplayNameChange,
  onPhotoUrlChange,
  onSave,
  onSendVerification,
  onResetPassword,
}: SettingsIdentitySectionProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const previewUrl = photoUrl.trim() && !photoFailed ? photoUrl.trim() : null;
  const initials = userInitials(user, displayName);
  const showVerification = Boolean(user.email) && !user.emailVerified;
  const showReset = hasPasswordProvider(user);

  return (
    <SettingsSection
      icon={UserRound}
      title="Identity"
      description="How you appear in interviews and across Vetta."
      variant="primary"
      hero
    >
      <div className="settings-identity__avatar-row">
        <div className="settings-identity__avatar" aria-hidden>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="settings-identity__badges">
          <span
            className={`settings-badge ${user.emailVerified ? 'settings-badge--verified' : 'settings-badge--unverified'}`}
          >
            {user.emailVerified ? 'Email verified' : 'Email not verified'}
          </span>
          <span className="settings-badge settings-badge--provider">{signInMethodLabel(user)}</span>
        </div>
      </div>

      <div className="settings-form-grid settings-form-grid--pair">
        <label className="settings-field">
          <span className="settings-field__label">Email</span>
          <div className="settings-input-wrap settings-input-wrap--readonly">
            <Mail className="settings-input-wrap__icon" aria-hidden />
            <input type="email" value={user.email || ''} readOnly className="settings-input" />
          </div>
        </label>

        <label className="settings-field">
          <span className="settings-field__label">Display name</span>
          <div className="settings-input-wrap">
            <BadgeCheck className="settings-input-wrap__icon" aria-hidden />
            <input
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              className="settings-input"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
        </label>
      </div>

      <label className="settings-field">
        <span className="settings-field__label">Photo URL</span>
        <input
          type="url"
          value={photoUrl}
          onChange={(e) => {
            setPhotoFailed(false);
            onPhotoUrlChange(e.target.value);
          }}
          className="settings-input settings-input--boxed settings-input--mono"
          placeholder="https://…"
          autoComplete="photo"
        />
        <span className="settings-field__hint">Paste a public image URL. Preview updates above.</span>
      </label>

      <button type="button" onClick={onSave} disabled={saving} className="settings-btn settings-btn--primary settings-btn--block">
        {saving ? 'Saving…' : 'Save identity'}
      </button>

      {showVerification || showReset ? (
        <div className="settings-inline-actions">
          {showVerification ? (
            <button
              type="button"
              onClick={onSendVerification}
              disabled={sendingVerification}
              className="settings-btn settings-btn--ghost"
            >
              {sendingVerification ? 'Sending…' : 'Send verification email'}
            </button>
          ) : null}
          {showReset ? (
            <button
              type="button"
              onClick={onResetPassword}
              disabled={sendingReset}
              className="settings-btn settings-btn--ghost"
            >
              {sendingReset ? 'Sending…' : 'Reset password'}
            </button>
          ) : null}
        </div>
      ) : null}
    </SettingsSection>
  );
}
