import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Check,
  Minus,
  Radar,
  Route,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const MATCHED_SKILLS = ['System Design', 'React Architecture'] as const;
const MISSING_SKILL = 'Distributed Caching';

const LOG_LINES = [
  '> initializing LiveKit voice pipeline...',
  '> loading session context: "Senior Product Manager", mode=pressure',
  '> interviewer agent online — latency 180ms',
  '> challenge injected: "Primary DB fails mid-session"',
] as const;

export function LandingFeatures() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="intelligence" className="scroll-mt-20 py-24">
      <div className="mb-16 text-center">
        <h2 className="type-headline-lg text-[var(--color-on-surface)]">
          Command Your Career Trajectory
        </h2>
        <p className="type-body-md mx-auto mt-4 max-w-2xl text-[var(--color-on-surface-variant)]">
          Stop rehearsing in the dark. Deploy intelligent mock interviews that analyze, challenge,
          and sharpen the signal employers actually score.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-12">
        <motion.article
          id="ai-interview"
          className="landing-feature-card group relative col-span-1 overflow-hidden p-8 md:col-span-8"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
        >
          <Radar
            className="pointer-events-none absolute right-8 top-8 h-[120px] w-[120px] text-[var(--color-primary)] opacity-10 transition-opacity group-hover:opacity-20"
            strokeWidth={1}
            aria-hidden="true"
          />
          <div className="relative z-10 md:w-2/3">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary-container)]/20 text-[var(--color-primary)]">
              <Radar className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="type-headline-md mb-3 text-[var(--color-on-surface)]">Semantic Scoring</h3>
            <p className="type-body-md mb-6 text-[var(--color-on-surface-variant)]">
              Instantly visualize your fit against any job description. Our NLP engine breaks down
              requirements and highlights exactly where you shine — and where to pivot before the
              real interview.
            </p>
            <div className="flex flex-wrap gap-2">
              {MATCHED_SKILLS.map((skill) => (
                <span key={skill} className="tag-matched font-mono text-xs">
                  {skill} (Matched)
                </span>
              ))}
              <span className="tag-missing gap-1.5 font-mono text-xs">
                <Minus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                {MISSING_SKILL} (Gap)
              </span>
            </div>
          </div>
        </motion.article>

        <motion.article
          className="landing-feature-card col-span-1 flex flex-col justify-between p-8 md:col-span-4"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.08 }}
        >
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-secondary-container)]/20 text-[var(--color-secondary)]">
              <Route className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="type-headline-md mb-3 text-[var(--color-on-surface)]">Career Intelligence</h3>
            <p className="type-body-md text-[var(--color-on-surface-variant)]">
              Actionable gap analysis and roadmap generation based on your interview history and
              market signals.
            </p>
          </div>
          <div className="mt-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-surface-container-low)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="type-code text-xs text-[var(--color-on-surface-variant)]">Next Milestone</span>
              <span className="type-code text-xs text-[var(--color-secondary)]">Est. 3 mo</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-variant)]">
              <div className="h-full w-2/3 rounded-full bg-[var(--color-secondary)]" />
            </div>
          </div>
        </motion.article>

        <motion.article
          className="landing-feature-card col-span-1 flex flex-col overflow-hidden md:col-span-12 md:flex-row"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.16 }}
        >
          <div className="flex flex-col justify-center border-b border-[var(--border-subtle)] p-8 md:w-1/2 md:border-b-0 md:border-r">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary-container)]/20 text-[var(--color-primary)]">
              <Bot className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="type-headline-md mb-3 text-[var(--color-on-surface)]">Live Interview Agent</h3>
            <p className="type-body-md mb-6 text-[var(--color-on-surface-variant)]">
              Real-time voice mock interviews that interrupt, follow up, and shift constraints —
              the same pressure as a senior panel, without the calendar invite.
            </p>
            <Link
              to="/signup"
              className="type-label-md inline-flex items-center gap-1 self-start text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-fixed)]"
            >
              Enter the room
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>

          <div
            className="relative overflow-hidden bg-[var(--color-background)] p-6 md:w-1/2"
            aria-label="Interview agent log preview"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--color-background)] to-transparent"
              aria-hidden="true"
            />
            <div className="type-code space-y-2 text-sm leading-relaxed">
              {LOG_LINES.map((line) => (
                <p key={line} className="text-[var(--color-on-surface-variant)]/70">
                  {line}
                </p>
              ))}
              <p className="flex items-center gap-2 text-[var(--color-secondary)]">
                <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                Strong Hire signal recorded. Fit: 92%
              </p>
              <p className="text-[var(--color-on-surface-variant)]/70">
                {'> '}tailoring follow-up for behavioral round...
              </p>
              <span className="terminal-cursor" aria-hidden="true" />
            </div>
          </div>
        </motion.article>
      </div>
    </section>
  );
}
