import { BarChart3, CheckCircle2, Minus } from 'lucide-react';

const MATCH_SCORE = 88;
const CIRCLE_RADIUS = 44;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const STROKE_OFFSET = CIRCLE_CIRCUMFERENCE * (1 - MATCH_SCORE / 100);

const MATCHED_SKILLS = ['Systems Arch', 'AI Integrations'] as const;
const MISSING_SKILL = 'Legacy Migrations';

export function AuthShowcasePanel() {
  return (
    <aside className="auth-showcase-panel hidden lg:flex lg:w-1/2 relative items-center justify-center border-l border-[var(--border-subtle)]">
      <div className="auth-showcase-panel__bg" aria-hidden="true" />
      <div className="auth-showcase-panel__overlay" aria-hidden="true" />

      <div className="auth-showcase-card relative z-10 w-full max-w-md mx-8">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-[var(--color-tertiary)]" strokeWidth={1.75} aria-hidden="true" />
            <h3 className="type-headline-md text-[var(--color-on-surface)]">Compatibility Engine</h3>
          </div>
          <div className="badge-agent-active type-label-sm text-[var(--color-tertiary)] tracking-widest">
            ACTIVE
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="url(#auth-compat-gradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={STROKE_OFFSET}
              />
              <defs>
                <linearGradient id="auth-compat-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-tertiary)" />
                  <stop offset="100%" stopColor="var(--color-primary)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="type-headline-lg text-[var(--color-on-surface)]">{MATCH_SCORE}%</span>
              <span className="type-label-sm uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                Match
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {MATCHED_SKILLS.map((skill) => (
              <span key={skill} className="tag-matched gap-1.5 font-mono text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                {skill}
              </span>
            ))}
            <span className="tag-missing gap-1.5 font-mono text-xs">
              <Minus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              {MISSING_SKILL}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
