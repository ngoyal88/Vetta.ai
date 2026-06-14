import React from 'react';
import type { LucideIcon } from 'lucide-react';

type SectionHeadingProps = {
  id: string;
  title: string;
  icon: LucideIcon;
  accent: 'primary' | 'secondary' | 'tertiary';
};

const ACCENT_CLASS = {
  primary: 'border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  secondary:
    'border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]',
  tertiary: 'border-[var(--color-tertiary)]/25 bg-[var(--color-tertiary)]/10 text-[var(--color-tertiary)]',
} as const;

export function SectionHeading({ id, title, icon: Icon, accent }: SectionHeadingProps) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div
        className={`resume-deep-dive-section-icon ${ACCENT_CLASS[accent]}`}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </div>
      <h2 id={id} className="type-headline-md text-[var(--color-on-surface)]">
        {title}
      </h2>
    </div>
  );
}
