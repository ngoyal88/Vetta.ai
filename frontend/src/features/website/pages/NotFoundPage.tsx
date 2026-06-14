import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { HelpCircle, Home, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';

import { WebsiteLayout } from '../components/WebsiteLayout';
import { useAuth } from 'shared/context/AuthContext';

const TELEMETRY_LEFT = [
  'TRC_SEQ: 0x8291_LOST',
  'LATENCY: INF_MS',
  'NODE_STAT: UNREACHABLE',
] as const;

const TELEMETRY_RIGHT = [
  'RADAR_SCAN: ACTIVE',
  'THREAT_LVL: NULL',
  'SYSTEM_UP: 99.98%',
] as const;

export default function NotFoundPage() {
  const { currentUser } = useAuth();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previous = document.title;
    document.title = '404 — Signal Lost | Vetta.ai';
    return () => {
      document.title = previous;
    };
  }, []);

  const primaryHref = currentUser ? '/dashboard' : '/';
  const primaryLabel = currentUser ? 'Return to Dashboard' : 'Return Home';
  const PrimaryIcon = currentUser ? LayoutDashboard : Home;

  const fadeIn = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0, 0, 0.2, 1] as const },
      };

  return (
    <WebsiteLayout
      footerVariant="full"
      mainClassName="not-found-page !flex !min-h-[calc(100vh-4rem)] !items-center !justify-center !pb-20 !pt-28"
    >
      <div className="not-found-page__glow" aria-hidden />

      <div className="not-found-kinetic-grid relative z-10 mx-auto w-full max-w-2xl px-4 text-center">
        <header className="not-found-hero">
          <div className="not-found-hero__rings" aria-hidden>
            <div className="not-found-signal-pulse h-64 w-64 rounded-full bg-[var(--color-primary)]/10" />
            <div className="not-found-signal-pulse not-found-signal-pulse--delayed absolute h-80 w-80 rounded-full bg-[var(--color-tertiary)]/5" />
          </div>

          <motion.div className="relative z-10 flex flex-col items-center" {...fadeIn}>
            <span
              className={`not-found-code ${reduceMotion ? '' : 'not-found-code--glitch'}`}
              data-text="404"
              aria-hidden
            >
              404
            </span>
            <div className="not-found-status">
              <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-error)] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--color-error)]" />
              </span>
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-on-surface)]">
                Signal Terminated
              </span>
            </div>
          </motion.div>
        </header>

        <motion.div
          className="not-found-card"
          {...(reduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 16 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.45, delay: 0.06, ease: [0, 0, 0.2, 1] as const },
              })}
        >
          <h1 className="type-headline-lg text-[var(--color-on-surface)]">404 — Signal Lost</h1>
          <p className="type-body-lg mx-auto mt-4 max-w-lg text-[var(--color-on-surface-variant)]">
            The intelligence node you&apos;re looking for has moved or is currently beyond our
            tactical radar. Let&apos;s get you back to command.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link to={primaryHref} className="not-found-btn not-found-btn--primary">
              <PrimaryIcon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              {primaryLabel}
            </Link>
            <Link to="/contact" className="not-found-btn not-found-btn--secondary">
              <HelpCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Visit Help Center
            </Link>
          </div>
        </motion.div>

        <div
          className="not-found-telemetry -bottom-12 -left-4 hidden text-[var(--color-primary)] lg:block"
          aria-hidden
        >
          {TELEMETRY_LEFT.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div
          className="not-found-telemetry -top-8 -right-4 hidden text-right text-[var(--color-tertiary)] lg:block"
          aria-hidden
        >
          {TELEMETRY_RIGHT.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </WebsiteLayout>
  );
}
