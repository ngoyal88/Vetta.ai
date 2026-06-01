import {
  CheckCircle2,
  Cpu,
  MoreHorizontal,
  Radar,
} from 'lucide-react';

const MATCH_SCORE = 85;
const CIRCLE_RADIUS = 45;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const STROKE_OFFSET = CIRCLE_CIRCUMFERENCE * (1 - MATCH_SCORE / 100);

const ACTIVE_SESSIONS = [
  {
    id: 'session-1',
    role: 'Senior Frontend Engineer — TechCorp',
    detail: 'System design follow-up in progress…',
    status: 'ACTIVE' as const,
    icon: Cpu,
  },
  {
    id: 'session-2',
    role: 'Staff UX Designer — DesignCo',
    detail: 'Session complete • Signal: Strong Hire',
    status: 'DONE' as const,
    icon: CheckCircle2,
  },
] as const;

export function LandingPreview() {
  return (
    <div className="landing-preview-window">
      <div className="flex h-12 items-center gap-4 border-b border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/50 px-6">
        <div className="flex gap-2" aria-hidden="true">
          <span className="h-3 w-3 rounded-full bg-[var(--color-error)]/50" />
          <span className="h-3 w-3 rounded-full bg-[var(--color-secondary)]/50" />
          <span className="h-3 w-3 rounded-full bg-[var(--color-tertiary)]/50" />
        </div>
        <code className="type-code ml-auto text-xs text-[var(--color-on-surface-variant)]">
          vetta.session.start(mode=&quot;role-targeted&quot;)
        </code>
      </div>

      <div
        className="grid grid-cols-1 gap-gutter bg-[var(--color-background)]/90 p-6 md:grid-cols-3 md:p-8"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 80%, rgba(77, 142, 255, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(79, 219, 200, 0.06) 0%, transparent 45%)',
        }}
      >
        <div className="glass-panel col-span-1 rounded-lg p-6 md:col-span-2">
          <div className="data-card__header !mb-6 !pb-4">
            <div className="flex items-center gap-3">
              <Radar className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={1.75} aria-hidden="true" />
              <h3 className="type-headline-md text-[var(--color-on-surface)]">Active Sessions</h3>
            </div>
            <MoreHorizontal className="h-5 w-5 text-[var(--color-on-surface-variant)]" aria-hidden="true" />
          </div>

          <ul className="space-y-4">
            {ACTIVE_SESSIONS.map(({ id, role, detail, status, icon: Icon }) => (
              <li
                key={id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-subtle)] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      status === 'ACTIVE'
                        ? 'bg-[var(--color-primary-container)]/20 text-[var(--color-primary)]'
                        : 'bg-[var(--color-tertiary-container)]/20 text-[var(--color-tertiary)]',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="type-label-md truncate text-[var(--color-on-surface)]">{role}</p>
                    <p className="type-label-sm mt-1 text-[var(--color-on-surface-variant)]">{detail}</p>
                  </div>
                </div>
                {status === 'ACTIVE' ? (
                  <span className="badge-agent-active shrink-0 type-label-sm uppercase tracking-widest">
                    Active
                  </span>
                ) : (
                  <span className="type-label-sm shrink-0 text-[var(--color-on-surface-variant)]">2h ago</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel flex flex-col items-center justify-center rounded-lg p-6 text-center">
          <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="url(#landing-fit-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRCLE_CIRCUMFERENCE}
                strokeDashoffset={STROKE_OFFSET}
              />
              <defs>
                <linearGradient id="landing-fit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-secondary)" />
                  <stop offset="100%" stopColor="var(--color-primary)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="type-headline-md text-[var(--color-on-surface)]">{MATCH_SCORE}%</span>
              <span className="type-label-sm uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                Overall Fit
              </span>
            </div>
          </div>
          <h4 className="type-label-md text-[var(--color-on-surface)]">Interview Readiness</h4>
          <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
            Top 15% of candidates for target roles.
          </p>
        </div>
      </div>
    </div>
  );
}
