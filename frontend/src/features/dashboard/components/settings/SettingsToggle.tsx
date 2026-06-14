import React, { type ReactNode } from 'react';

type SettingsToggleProps = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function SettingsToggle({ id, label, description, icon, checked, onChange }: SettingsToggleProps) {
  return (
    <div className="settings-toggle-row">
      <span className="settings-toggle-row__icon" aria-hidden>
        {icon}
      </span>
      <div className="settings-toggle-row__copy">
        <label htmlFor={id} className="settings-toggle-row__label">
          {label}
        </label>
        <p className="settings-toggle-row__description">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={`settings-switch ${checked ? 'settings-switch--on' : ''}`}
      >
        <span className="settings-switch__thumb" />
      </button>
    </div>
  );
}
