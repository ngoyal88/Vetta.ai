import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';

import type { VaultHubQuickLinkColor } from 'features/vault/constants/hubQuickLinks';

type VaultHubQuickLinkProps = {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: VaultHubQuickLinkColor;
};

const COLOR_STYLES: Record<VaultHubQuickLinkColor, { icon: string; arrow: string }> = {
  teal: {
    icon: 'border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]',
    arrow: 'group-hover:text-[var(--color-secondary)]',
  },
  primary: {
    icon: 'border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    arrow: 'group-hover:text-[var(--color-primary)]',
  },
};

export default function VaultHubQuickLink({
  to,
  icon: Icon,
  title,
  description,
  color,
}: VaultHubQuickLinkProps) {
  const styles = COLOR_STYLES[color];

  return (
    <Link
      to={to}
      className="glass-panel group flex min-h-[11.5rem] flex-1 flex-col rounded-2xl p-6 transition-colors hover:bg-[var(--color-surface-container-high)]"
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg border ${styles.icon}`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>

      <h3 className="type-headline-md flex items-center justify-between gap-3 text-[var(--color-on-surface)]">
        <span>{title}</span>
        <ArrowRight
          className={`h-5 w-5 shrink-0 text-[var(--color-outline)] transition-colors group-hover:translate-x-0.5 ${styles.arrow}`}
          aria-hidden
        />
      </h3>

      <p className="type-body-md mt-2 flex-1 text-[var(--color-on-surface-variant)]">{description}</p>
    </Link>
  );
}
