import React, { memo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { User } from 'firebase/auth';

import { DeleteAccountModal } from './DeleteAccountModal';
import { SettingsSection } from './SettingsSection';

type SettingsDangerSectionProps = {
  user: User;
  deleting: boolean;
  onDeleteAccount: (options: { password?: string; useGoogle: boolean }) => Promise<void>;
};

function SettingsDangerSectionComponent({
  user,
  deleting,
  onDeleteAccount,
}: SettingsDangerSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <SettingsSection
        icon={AlertTriangle}
        title="Delete account"
        description="Permanently remove your account and all associated data."
        variant="danger"
      >
        <p className="settings-danger__copy">
          This removes interview history, resume vault files, verified profile claims, profile memory, and
          your authentication record. This cannot be undone.
        </p>
        <button
          type="button"
          disabled={deleting}
          onClick={() => setModalOpen(true)}
          className="settings-btn settings-btn--danger settings-btn--block"
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
      </SettingsSection>

      <DeleteAccountModal
        open={modalOpen}
        user={user}
        deleting={deleting}
        onClose={() => setModalOpen(false)}
        onConfirm={async (options) => {
          await onDeleteAccount(options);
          setModalOpen(false);
        }}
      />
    </>
  );
}

export const SettingsDangerSection = memo(SettingsDangerSectionComponent);
