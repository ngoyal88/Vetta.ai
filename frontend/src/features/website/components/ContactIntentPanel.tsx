import { Building2, Mail, Megaphone, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ContactIntent = 'candidate' | 'enterprise' | 'press';

type IntentOption = {
  id: ContactIntent;
  title: string;
  description: string;
  icon: LucideIcon;
};

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'candidate',
    title: 'Candidate',
    description: 'Inquiries regarding profile optimization, AI agents, or platform access.',
    icon: User,
  },
  {
    id: 'enterprise',
    title: 'Enterprise / Coach',
    description: 'Partnerships, bulk licensing, and integration capabilities.',
    icon: Building2,
  },
  {
    id: 'press',
    title: 'Press',
    description: 'Media inquiries, brand assets, and interview requests.',
    icon: Megaphone,
  },
];

type ContactIntentPanelProps = {
  selected: ContactIntent;
  onSelect: (intent: ContactIntent) => void;
};

export function ContactIntentPanel({ selected, onSelect }: ContactIntentPanelProps) {
  return (
    <div className="flex flex-col gap-stack-lg lg:col-span-5">
      <div className="flex flex-col gap-4">
        <div className="landing-status-pill type-label-sm uppercase tracking-widest text-[var(--color-secondary)] self-start">
          <span className="badge-agent-active type-label-sm uppercase tracking-widest">Support Live</span>
          <span className="text-[var(--color-on-surface-variant)]" aria-hidden="true">
            &bull;
          </span>
          <span className="text-[var(--color-on-surface-variant)]">Response &lt; 24h</span>
        </div>
        <h1 className="type-display-lg mb-2 text-gradient-primary md:text-[clamp(2.5rem,5vw,4rem)] md:leading-[1.1]">
          Let&apos;s talk.
        </h1>
        <p className="type-body-lg max-w-md text-[var(--color-on-surface-variant)]">
          Direct connection to the Vetta.ai Intelligence Systems core. Select your operational
          intent below.
        </p>
      </div>

      <div className="mt-2 flex flex-col gap-stack-md" role="radiogroup" aria-label="Contact intent">
        {INTENT_OPTIONS.map(({ id, title, description, icon: Icon }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSelect(id)}
              className={[
                'contact-intent-card group flex items-start gap-4 rounded-xl p-6 text-left transition-all duration-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                isActive ? 'contact-intent-card--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                className={[
                  'flex shrink-0 rounded-lg p-3 transition-colors',
                  isActive
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'bg-[var(--color-surface-variant)]/50 text-[var(--color-primary)] group-hover:bg-[var(--color-primary)]/15',
                ].join(' ')}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div>
                <h3 className="type-headline-md mb-1 text-[var(--color-on-surface)]">{title}</h3>
                <p className="type-body-md text-[var(--color-on-surface-variant)]">{description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-3 pt-stack-lg text-[var(--color-on-surface-variant)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">
          <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <a
          href="mailto:hello@vetta.ai"
          className="type-code text-sm transition-colors hover:text-[var(--color-secondary)]"
        >
          hello@vetta.ai
        </a>
      </div>
    </div>
  );
}
