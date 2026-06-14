import React from 'react';
import { MicOff, SlidersHorizontal } from 'lucide-react';

import { SettingsSection } from './SettingsSection';
import { SettingsToggle } from './SettingsToggle';

type SettingsInterviewSectionProps = {
  defaultRole: string;
  defaultYoe: number;
  skipPrecheck: boolean;
  saving: boolean;
  onDefaultRoleChange: (value: string) => void;
  onDefaultYoeChange: (value: number) => void;
  onSkipPrecheckChange: (value: boolean) => void;
  onSave: () => void;
};

export function SettingsInterviewSection({
  defaultRole,
  defaultYoe,
  skipPrecheck,
  saving,
  onDefaultRoleChange,
  onDefaultYoeChange,
  onSkipPrecheckChange,
  onSave,
}: SettingsInterviewSectionProps) {
  return (
    <SettingsSection
      icon={SlidersHorizontal}
      title="Interview defaults"
      description="Prefill setup screens and control session launch behavior."
      variant="primary"
    >
      <div className="settings-role-fields">
        <label className="settings-role-fields__cell" htmlFor="settings-default-role">
          <span className="settings-field__label">Default target role</span>
          <input
            id="settings-default-role"
            type="text"
            value={defaultRole}
            onChange={(e) => onDefaultRoleChange(e.target.value)}
            className="settings-input settings-input--boxed"
            placeholder="e.g. Senior Frontend Engineer"
            autoComplete="organization-title"
          />
        </label>

        <label className="settings-role-fields__cell" htmlFor="settings-default-yoe">
          <span className="settings-field__label">Default years of experience</span>
          <input
            id="settings-default-yoe"
            type="number"
            min={0}
            max={50}
            value={defaultYoe}
            onChange={(e) => onDefaultYoeChange(Number(e.target.value) || 0)}
            className="settings-input settings-input--boxed"
          />
        </label>
      </div>

      <SettingsToggle
        id="settings-skip-precheck"
        label="Skip device check"
        description="Join interviews immediately without the pre-session mic and connection check."
        icon={<MicOff className="h-5 w-5" aria-hidden />}
        checked={skipPrecheck}
        onChange={onSkipPrecheckChange}
      />

      <button type="button" onClick={onSave} disabled={saving} className="settings-btn settings-btn--primary">
        {saving ? 'Saving…' : 'Save interview defaults'}
      </button>
    </SettingsSection>
  );
}
