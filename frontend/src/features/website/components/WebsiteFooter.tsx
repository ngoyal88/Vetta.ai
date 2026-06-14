import { Link, useLocation } from 'react-router-dom';
import { Code2, Hexagon, Share2 } from 'lucide-react';

import { AuthBrandLink } from 'features/auth/components/AuthBrandLink';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Platform', href: '#platform' },
      { label: 'Intelligence', href: '#intelligence' },
      { label: 'AI Interview', href: '#ai-interview' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Signal Scoring', href: '/signup' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#resources' },
      { label: 'Interview Guides', href: '#resources' },
      { label: 'Support', href: '#resources' },
      { label: 'API Reference', href: '#resources' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#resources' },
      { label: 'Careers', href: '#resources' },
      { label: 'Contact', href: '/contact' },
      { label: 'Partners', href: '#resources' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#privacy' },
      { label: 'Terms of Service', href: '#privacy' },
      { label: 'Security', href: '#privacy' },
      { label: 'Cookie Policy', href: '#privacy' },
    ],
  },
] as const;

function FooterLink({ href, label, emphasize }: { href: string; label: string; emphasize?: boolean }) {
  const location = useLocation();
  const isActive = href === '/contact' && location.pathname === '/contact';
  const className = [
    emphasize || isActive ? 'type-label-md' : 'type-body-md',
    isActive || emphasize
      ? 'font-bold text-[var(--color-primary)]'
      : 'text-[var(--color-on-surface-variant)]',
    'transition-colors hover:text-[var(--color-primary)]',
  ].join(' ');

  if (href.startsWith('/#')) {
    return (
      <Link to={{ pathname: '/', hash: href.slice(2) }} className={className}>
        {label}
      </Link>
    );
  }

  if (href.startsWith('/') && !href.includes('#')) {
    return (
      <Link to={href} className={className}>
        {label}
      </Link>
    );
  }

  if (href.startsWith('#')) {
    return (
      <Link to={{ pathname: '/', hash: href }} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

type WebsiteFooterProps = {
  variant?: 'full' | 'compact';
};

const COMPACT_LINKS = [
  { label: 'Privacy Policy', href: '/#privacy' },
  { label: 'Terms of Service', href: '/#privacy' },
  { label: 'Security', href: '/#privacy' },
  { label: 'API Documentation', href: '/#resources' },
  { label: 'Careers', href: '/#resources' },
  { label: 'Contact', href: '/contact' },
] as const;

export function WebsiteFooter({ variant = 'full' }: WebsiteFooterProps) {
  const year = new Date().getFullYear();

  if (variant === 'compact') {
    return (
      <footer className="relative z-10 mt-12 border-t border-[var(--border-subtle)] bg-[var(--color-surface-container-lowest)]">
        <div className="mx-auto grid max-w-app grid-cols-2 gap-gutter px-[var(--space-margin-mobile)] py-stack-lg md:grid-cols-4 md:px-[var(--space-margin-desktop)] lg:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-3 md:col-span-4 lg:col-span-2">
            <AuthBrandLink
              icon={
                <Hexagon
                  className="h-6 w-6 text-[var(--color-primary)]"
                  strokeWidth={1.75}
                  fill="currentColor"
                  fillOpacity={0.15}
                  aria-hidden="true"
                />
              }
              labelClassName="type-headline-md text-[var(--color-primary)]"
            />
            <p className="type-label-sm text-[var(--color-secondary)]">
              © {year} Vetta.ai. System Status: Operational.
            </p>
          </div>

          {COMPACT_LINKS.map(({ label, href }) => (
            <FooterLink
              key={label}
              href={href}
              label={label}
              emphasize={label === 'Contact'}
            />
          ))}
        </div>
      </footer>
    );
  }

  return (
    <footer
      id="resources"
      className="scroll-mt-20 border-t border-[var(--border-subtle)] bg-[var(--color-surface-container-lowest)] pt-20 pb-10"
    >
      <div className="mx-auto max-w-app px-[var(--space-margin-mobile)] md:px-[var(--space-margin-desktop)]">
        <div className="mb-20 grid grid-cols-1 gap-y-12 md:grid-cols-12 md:gap-x-gutter">
          <div className="flex flex-col gap-6 md:col-span-4">
            <div className="flex flex-col gap-2">
              <AuthBrandLink
                icon={
                  <Hexagon
                    className="h-7 w-7 text-[var(--color-primary)]"
                    strokeWidth={1.75}
                    fill="currentColor"
                    fillOpacity={0.15}
                    aria-hidden="true"
                  />
                }
                labelClassName="type-headline-md font-bold text-[var(--color-primary)]"
              />
              <p className="type-label-md uppercase tracking-widest text-[var(--color-secondary)]">
                Career Intelligence
              </p>
            </div>
            <p className="type-body-md max-w-xs text-[var(--color-on-surface-variant)]">
              Built for the future of work. Empowering candidates with interview-grade intelligence
              to command their career trajectory.
            </p>
            <div className="flex gap-3">
              <a
                href="#resources"
                className="glass-panel flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-primary)]"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" strokeWidth={1.75} />
              </a>
              <a
                href="#resources"
                className="glass-panel flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-primary)]"
                aria-label="Developer resources"
              >
                <Code2 className="h-4 w-4" strokeWidth={1.75} />
              </a>
            </div>
          </div>

          <div className="md:col-span-8">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {FOOTER_COLUMNS.map(({ title, links }) => (
                <div key={title} className="flex flex-col gap-4">
                  <h5 className="type-label-md uppercase tracking-wider text-[var(--color-on-surface)]">
                    {title}
                  </h5>
                  <div className="flex flex-col gap-3">
                    {links.map(({ label, href }) => (
                      <FooterLink key={`${title}-${label}`} href={href} label={label} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          id="privacy"
          className="flex flex-col items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-8 md:flex-row"
        >
          <p className="type-label-sm text-[var(--color-on-surface-variant)]/70">
            © {year} Vetta.ai — Empowering the global workforce.
          </p>
          <p className="badge-online type-label-sm !font-sans normal-case tracking-normal">
            System Status: Online
          </p>
        </div>
      </div>
    </footer>
  );
}
