import React from 'react';
import { Lock, Rocket } from 'lucide-react';

type RoleTargetedLaunchFooterProps = {
  canLaunch: boolean;
  starting: boolean;
  roleValue: string;
  onLaunch: () => void;
};

export function RoleTargetedLaunchFooter({
  canLaunch,
  starting,
  roleValue,
  onLaunch,
}: RoleTargetedLaunchFooterProps) {
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-[var(--border-subtle)] pt-6">
      <button
        type="button"
        onClick={onLaunch}
        disabled={!canLaunch}
        className="flex w-full max-w-md items-center justify-center gap-3 rounded-xl bg-[var(--color-primary-container)] px-6 py-3.5 text-base font-semibold text-[var(--color-on-primary-container)] shadow-luminous transition-all hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {starting ? 'Launching room…' : 'Launch interview room'}
        <Rocket className="h-5 w-5" aria-hidden />
      </button>
      {!roleValue ? (
        <p className="type-label-sm text-[var(--color-on-surface-variant)]">Enter a target role to continue.</p>
      ) : null}
      <p className="flex items-center gap-2 type-label-sm text-[var(--color-outline)]">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        Session is private and encrypted
      </p>
    </footer>
  );
}
