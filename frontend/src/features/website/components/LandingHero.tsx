import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PlayCircle } from 'lucide-react';

import { LandingPreview } from './LandingPreview';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export function LandingHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="platform"
      className="relative scroll-mt-20 flex min-h-[85vh] flex-col items-center justify-center py-20 text-center"
    >
      <div className="landing-grid-pattern pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
      <div
        className="landing-hero-glow pointer-events-none absolute left-1/2 top-1/2 h-[min(600px,80vw)] w-[min(600px,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        aria-hidden="true"
      />

      <motion.div
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-stack-lg"
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        transition={{ staggerChildren: reduceMotion ? 0 : 0.12, duration: 0.5, ease: [0, 0, 0.2, 1] }}
      >
        <motion.div
          variants={fadeUp}
          className="landing-status-pill type-label-sm uppercase tracking-widest text-[var(--color-secondary)]"
        >
          <span className="badge-agent-active type-label-sm uppercase tracking-widest">System Online</span>
          <span className="text-[var(--color-on-surface-variant)]" aria-hidden="true">
            •
          </span>
          <span className="text-[var(--color-on-surface-variant)]">Beta v1.0</span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="type-display-lg max-w-3xl text-[var(--color-on-surface)]"
        >
          The interview room doesn&apos;t wait.{' '}
          <span className="text-gradient-primary">We make you ready.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="type-body-lg max-w-2xl text-[var(--color-on-surface-variant)]"
        >
          Where companies deploy AI to evaluate you, Vetta.ai gives that same intelligence back to
          the candidate — live mock interviews, semantic fit scoring, and a command center built for
          your next hire.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-2 flex w-full flex-col gap-4 sm:w-auto sm:flex-row"
        >
          <Link to="/signup" className="landing-cta-primary w-full sm:w-auto">
            Join the Beta
          </Link>
          <a href="#intelligence" className="landing-cta-ghost w-full sm:w-auto">
            <PlayCircle className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={1.75} aria-hidden="true" />
            See how it works
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        className="relative z-10 mt-20 w-full max-w-5xl"
        initial={reduceMotion ? false : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.35, duration: 0.6, ease: [0, 0, 0.2, 1] }}
      >
        <LandingPreview />
      </motion.div>
    </section>
  );
}
