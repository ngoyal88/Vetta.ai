import type { ReactNode } from 'react';

import { WebsiteFooter } from './WebsiteFooter';
import { WebsiteNavbar } from './WebsiteNavbar';

type WebsiteLayoutProps = {
  children: ReactNode;
  footerVariant?: 'full' | 'compact';
  showDecorations?: boolean;
  mainClassName?: string;
};

const DATA_FRAGMENTS = [
  { text: '[NODE_ID: 771-VETTA]', className: 'left-10 top-24 hidden lg:block' },
  { text: '[ENCRYPTION: ACTIVE]', className: 'bottom-40 right-20 hidden lg:block' },
  { text: '[STATUS: ONLINE]', className: 'left-4 top-1/2 hidden -rotate-90 lg:block' },
] as const;

export function WebsiteLayout({
  children,
  footerVariant = 'full',
  showDecorations = false,
  mainClassName = '',
}: WebsiteLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-background)] text-[var(--color-on-surface)] selection:bg-[var(--color-primary-container)]/30 selection:text-[var(--color-on-primary-container)]">
      <div className="landing-grid-pattern pointer-events-none fixed inset-0 opacity-40" aria-hidden="true" />

      {showDecorations
        ? DATA_FRAGMENTS.map(({ text, className }) => (
            <span
              key={text}
              className={`type-code pointer-events-none absolute z-0 select-none text-[10px] text-white/10 ${className}`}
              aria-hidden="true"
            >
              {text}
            </span>
          ))
        : null}

      <WebsiteNavbar />

      <main
        className={[
          'relative z-10 mx-auto w-full max-w-app px-[var(--space-margin-mobile)] pb-24 pt-24 md:px-[var(--space-margin-desktop)]',
          mainClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </main>

      <WebsiteFooter variant={footerVariant} />
    </div>
  );
}
