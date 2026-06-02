import React from 'react';
import { CheckCircle2, Lock, Rocket, Zap } from 'lucide-react';

type LaunchFooterProps = {
  systemReady: boolean;
  canLaunch: boolean;
  starting: boolean;
  onLaunch: () => void;
};

export function LaunchFooter({ systemReady, canLaunch, starting, onLaunch }: LaunchFooterProps) {
  return (
    <footer className="glass-panel flex flex-col items-stretch justify-between gap-6 rounded-2xl border-t-2 border-t-[var(--color-primary)]/20 p-5 md:flex-row md:items-center md:p-6">
      <div className="flex items-start gap-4 md:items-center">
        <div className="relative shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-secondary)]/10">
            <Zap
              className="h-6 w-6 fill-[var(--color-secondary)] text-[var(--color-secondary)]"
              aria-hidden
            />
          </div>
          {systemReady ? (
            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-surface)]">
              <span className="resume-deep-dive-pulse h-2.5 w-2.5 rounded-full bg-[var(--color-secondary)]" />
            </div>
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-label-sm font-bold uppercase tracking-widest text-[var(--color-secondary)]">
              {systemReady ? 'System ready' : 'Awaiting resume'}
            </span>
            {systemReady ? (
              <span className="dashboard-chip inline-flex items-center gap-1.5 !py-0.5 !text-[10px] uppercase">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Configured
              </span>
            ) : null}
          </div>
          <p className="type-body-md mt-1 text-[var(--color-on-surface-variant)]">
            {systemReady
              ? 'Configuration validated. Initialize when you are ready to enter the room.'
              : 'Activate a résumé in Vault to unlock deep-dive configuration.'}
          </p>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col items-center gap-3 md:w-auto md:min-w-[280px]">
        <button
          type="button"
          onClick={onLaunch}
          disabled={!canLaunch}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--color-primary-container)] px-8 py-3.5 text-base font-semibold text-[var(--color-on-primary-container)] shadow-luminous transition-all hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? 'Initializing…' : 'Initialize deep-dive'}
          <Rocket className="h-5 w-5" aria-hidden />
        </button>
        <p className="flex items-center gap-2 type-label-sm text-[var(--color-outline)]">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          Session is private and encrypted
        </p>
      </div>
    </footer>
  );
}
