import React, { memo } from 'react';
import { AlertTriangle } from 'lucide-react';

import { useConfirmDialog } from 'shared/context/ConfirmDialogContext';
import { SettingsSection } from './SettingsSection';

type SettingsDangerSectionProps = {
  deleting: boolean;
  onDeleteAccount: () => void;
};

function SettingsDangerSectionComponent({ deleting, onDeleteAccount }: SettingsDangerSectionProps) {
  const { confirmDialog } = useConfirmDialog();

  return (
    <SettingsSection
      icon={AlertTriangle}
      title="Delete account"
      description="Permanently remove your account and all associated data."
      variant="danger"
    >
      <p className="settings-danger__copy">
        This removes interview history, resume vault files, Signal enrichments, profile memory, and
        your authentication record. This cannot be undone.
      </p>
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          confirmDialog({
            title: 'Delete account',
            message:
              'Delete your account and all interview, vault, and signal data? This cannot be undone.',
            destructive: true,
            onConfirm: onDeleteAccount,
          });
        }}
        className="settings-btn settings-btn--danger settings-btn--block"
      >
        {deleting ? 'Deleting…' : 'Delete account'}
      </button>
    </SettingsSection>
  );
}

export const SettingsDangerSection = memo(SettingsDangerSectionComponent);
