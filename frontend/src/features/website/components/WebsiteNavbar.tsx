import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Hexagon, Menu, X } from 'lucide-react';

import { useAuth } from 'shared/context/AuthContext';
import { AuthBrandLink } from 'features/auth/components/AuthBrandLink';
import { WEBSITE_NAV_LINKS } from '../websiteNavLinks';

export function WebsiteNavbar() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentUser]);

  return (
    <>
      <header
        className={[
          'landing-navbar fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300',
          scrolled ? 'landing-navbar--scrolled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <nav
          className="mx-auto flex h-16 max-w-app items-center justify-between gap-4 px-[var(--space-margin-mobile)] md:px-[var(--space-margin-desktop)]"
          aria-label="Landing"
        >
          <div className="flex min-w-0 items-center gap-8">
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
              labelClassName="type-headline-md tracking-tight text-[var(--color-primary)]"
            />

            <div className="hidden items-center gap-1 md:flex">
              {WEBSITE_NAV_LINKS.map(({ label, href }) => {
                const isActive = href === location.pathname;
                return (
                  <Link
                    key={href}
                    to={href}
                    className={[
                      'landing-nav-link',
                      isActive ? '!text-[var(--color-primary)]' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <Link to="/dashboard" className="landing-cta-primary !px-6 !py-2.5 text-sm">
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="landing-nav-link hidden md:inline-flex"
                >
                  Sign In
                </Link>
                <Link to="/signup" className="landing-cta-primary !px-6 !py-2.5 text-sm">
                  Get Started
                </Link>
              </>
            )}

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-on-surface)] transition-colors hover:bg-white/5 md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </header>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[var(--color-background)]/60 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="fixed inset-x-0 top-16 z-[45] border-b border-[var(--border)] bg-[var(--color-surface-container-low)] p-4 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-1">
              {WEBSITE_NAV_LINKS.map(({ label, href }) => {
                const isActive = href === location.pathname;
                return (
                  <Link
                    key={href}
                    to={href}
                    className={[
                      'landing-nav-link block',
                      isActive ? '!text-[var(--color-primary)]' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setMobileOpen(false)}
                  >
                    {label}
                  </Link>
                );
              })}
              {!currentUser ? (
                <Link
                  to="/signin"
                  className="landing-nav-link mt-2 block"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
