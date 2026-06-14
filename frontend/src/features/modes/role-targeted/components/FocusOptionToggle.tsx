import React, { memo } from 'react';
import type { LucideIcon } from 'lucide-react';

type FocusOptionToggleProps = {
  value: string;
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onToggle: (value: string) => void;
};

export const FocusOptionToggle = memo(function FocusOptionToggle({
  value,
  label,
  icon: Icon,
  selected,
  onToggle,
}: FocusOptionToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(value)}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 type-label-sm transition-all ${
        selected
          ? 'border-[var(--color-tertiary)] bg-[var(--color-tertiary-container)]/20 text-[var(--color-tertiary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-tertiary)_35%,transparent)]'
          : 'border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/40 text-[var(--color-on-surface-variant)] hover:border-[var(--color-outline-variant)]/50 hover:text-[var(--color-on-surface)]'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
});
