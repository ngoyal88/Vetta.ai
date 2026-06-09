import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';

type Accent = 'secondary' | 'primary';

interface VaultHubShortcutCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  accent: Accent;
}

const ACCENT_STYLES: Record<
  Accent,
  { glow: string; icon: string; arrow: string }
> = {
  secondary: {
    glow: 'bg-[var(--color-secondary)]/10',
    icon: 'border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]',
    arrow: 'group-hover:text-[var(--color-secondary)]',
  },
  primary: {
    glow: 'bg-[var(--color-primary)]/10',
    icon: 'border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    arrow: 'group-hover:text-[var(--color-primary)]',
  },
};

export default function VaultHubShortcutCard({
  to,
  icon: Icon,
  title,
  description,
  accent,
}: VaultHubShortcutCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <Link
      to={to}
      className="glass-panel group relative flex min-h-[11.5rem] flex-1 flex-col overflow-hidden rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-0.5"
    >
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-[40px] transition-opacity duration-500 group-hover:opacity-90 ${styles.glow}`}
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col">
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg border ${styles.icon}`}
        >
          <Icon className="h-6 w-6" aria-hidden />
        </div>

        <h3 className="type-headline-md flex items-center justify-between gap-3 text-[var(--color-on-surface)]">
          <span>{title}</span>
          <ArrowRight
            className={`h-5 w-5 shrink-0 text-[var(--color-outline)] transition-all group-hover:translate-x-0.5 ${styles.arrow}`}
            aria-hidden
          />
        </h3>

        <p className="type-body-md mt-2 flex-1 text-[var(--color-on-surface-variant)]">
          {description}
        </p>
      </div>
    </Link>
  );
}
