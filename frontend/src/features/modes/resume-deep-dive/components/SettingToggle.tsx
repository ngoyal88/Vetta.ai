import React from 'react';

type SettingToggleProps = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function SettingToggle({
  id,
  label,
  description,
  icon,
  checked,
  onChange,
}: SettingToggleProps) {
  return (
    <div className="resume-deep-dive-setting flex h-full min-h-[5.5rem] items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-lowest)]/30 p-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-variant)]/50 text-[var(--color-on-surface-variant)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="type-label-md text-[var(--color-on-surface)]">{label}</p>
          <p className="type-label-sm mt-0.5 text-[var(--color-on-surface-variant)]">{description}</p>
        </div>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`resume-deep-dive-toggle ${checked ? 'resume-deep-dive-toggle--on' : ''}`}
      >
        <span className="resume-deep-dive-toggle__thumb" />
      </button>
    </div>
  );
}
