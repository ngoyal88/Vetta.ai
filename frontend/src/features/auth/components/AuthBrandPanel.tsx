import { CheckCircle2, LayoutGrid } from 'lucide-react';

import { AuthBrandLink } from './AuthBrandLink';

const TRUST_SIGNALS = ['Real-time Analysis', 'Living Profile'] as const;

export function AuthBrandPanel() {
  return (
    <div className="auth-brand-panel auth-brand-panel--signup hidden lg:flex w-1/2 relative flex-col border-r border-[var(--border-subtle)]">
      <div className="auth-brand-panel__bg" aria-hidden="true" />
      <div className="auth-brand-panel__overlay" aria-hidden="true" />

      <AuthBrandLink
        icon={
          <LayoutGrid
            className="h-8 w-8 text-[var(--color-primary)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        }
        className="auth-brand-panel__logo relative z-20"
      />

      <div className="auth-brand-panel__body relative z-20">
        <div className="auth-brand-panel__copy max-w-lg">
          <h1 className="auth-brand-panel__headline leading-tight">
            Outsmart the ATS.
            <br />
            <span className="auth-gradient-text">Own your narrative.</span>
          </h1>
          <p className="auth-brand-panel__subtext type-body-lg text-[var(--color-on-surface-variant)] max-w-md">
            Build your living profile. Our intelligence engine analyzes your trajectory, scores
            compatibility, and positions you at the helm of your career.
          </p>

          <div className="auth-brand-panel__pills">
            {TRUST_SIGNALS.map((label) => (
              <div key={label} className="auth-trust-pill">
                <CheckCircle2
                  className="h-4 w-4 shrink-0 text-[var(--color-tertiary)]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span className="type-label-sm text-[var(--color-on-surface-variant)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
