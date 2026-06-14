import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Clock, Lock, Sparkles } from "lucide-react";

import {
  AI_INTERVIEW_ANALYTICS_PATH,
  AI_INTERVIEW_HISTORY_PATH,
} from "core/constants/interviewModes";

import {
  ACTIVE_MODES,
  COMING_SOON_MODES,
  type CtaVariant,
  type ModeCatalogEntry,
} from "features/modes/catalog/modeCatalog";
import { FADE_UP_TRANSITION, fadeUpWithDelay } from "features/modes/shared/utils/motion";

const ACCENT_STYLES = {
  primary: {
    glow: "bg-[var(--color-primary)]/10",
    icon: "border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  },
  tertiary: {
    glow: "bg-[var(--color-tertiary)]/10",
    icon: "border-[var(--color-tertiary)]/25 bg-[var(--color-tertiary)]/10 text-[var(--color-tertiary)]",
  },
} as const;

const BADGE_STYLES = {
  hard: {
    wrapper: "border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-[var(--color-error)]",
    dot: "bg-[var(--color-error)]",
  },
  medium: {
    wrapper:
      "border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]",
    dot: "bg-[var(--color-secondary)]",
  },
} as const;

const CTA_STYLES = {
  primary:
    "bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] shadow-luminous",
  outline:
    "border border-[var(--border-strong)] bg-transparent text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]",
} as const;

const HEADER_ACTION_CLASS =
  "glass-panel inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-container)]";

function ActiveModeCard({
  mode,
  index,
  reduceMotion,
  onNavigate,
}: {
  mode: ModeCatalogEntry;
  index: number;
  reduceMotion: boolean | null;
  onNavigate: (route: string) => void;
}) {
  const accent = ACCENT_STYLES[mode.accent ?? "primary"];
  const badge = BADGE_STYLES[mode.badgeTone ?? "hard"];
  const Icon = mode.icon;
  const CtaIcon = mode.ctaIcon;
  const ctaVariant: CtaVariant = mode.ctaVariant ?? "primary";

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: fadeUpWithDelay(index * 0.08),
      };

  return (
    <motion.article
      {...motionProps}
      className="glass-panel group relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1"
    >
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-[40px] transition-colors duration-500 group-hover:opacity-90 ${accent.glow}`}
        aria-hidden
      />
      <div className="relative z-10 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg border ${accent.icon}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        {mode.difficulty ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${badge.wrapper}`}
          >
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} aria-hidden="true" />
            {mode.difficulty}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 mt-6 flex flex-1 flex-col">
        <h3 className="type-headline-md text-[var(--color-on-surface)]">{mode.title}</h3>
        <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">{mode.summary}</p>
        <button
          type="button"
          onClick={() => onNavigate(mode.route)}
          className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors ${CTA_STYLES[ctaVariant]}`}
        >
          {mode.ctaLabel}
          {CtaIcon ? <CtaIcon className="h-4 w-4" aria-hidden="true" /> : null}
        </button>
      </div>
    </motion.article>
  );
}

function ComingSoonModeCard({
  mode,
  index,
  reduceMotion,
}: {
  mode: ModeCatalogEntry;
  index: number;
  reduceMotion: boolean | null;
}) {
  const Icon = mode.icon;
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: fadeUpWithDelay(0.08 + index * 0.05),
      };

  return (
    <motion.article
      {...motionProps}
      className="glass-panel group relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-dashed border-[var(--border-strong)] p-6"
    >
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[var(--color-surface-container-high)]/80 p-4 text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <Lock className="h-8 w-8 text-[var(--color-on-surface-variant)]" aria-hidden="true" />
        <p className="type-label-sm text-[var(--color-on-surface)]">{mode.status}</p>
        <button
          type="button"
          disabled
          className="w-full rounded-lg border border-[var(--color-primary)]/40 px-4 py-2 text-sm font-semibold text-[var(--color-primary)] opacity-70"
        >
          Notify Me
        </button>
      </div>

      <div className="relative z-10 flex h-full flex-col gap-4 opacity-60">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-surface-bright)] text-[var(--color-on-surface)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="type-body-lg text-[var(--color-on-surface)]">{mode.title}</h3>
          <p className="type-label-sm mt-1 text-[var(--color-on-surface-variant)]">{mode.summary}</p>
        </div>
      </div>
    </motion.article>
  );
}

export default function AiInterviewPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: FADE_UP_TRANSITION,
      };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden pb-14 pt-10">
      <div
        className="pointer-events-none absolute -top-20 left-1/3 h-[360px] w-[360px] rounded-full bg-[var(--color-primary)]/10 blur-[120px]"
        aria-hidden
      />
      <div className="app-container relative z-10 flex flex-col gap-10">
        <motion.header
          {...headerMotion}
          className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-3xl">
            <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
              AI Interview
            </p>
            <h1 className="type-display-lg mt-2 text-[var(--color-on-surface)]">
              Choose Your Training Regimen
            </h1>
            <p className="type-body-lg mt-4 text-[var(--color-on-surface-variant)]">
              Immersive, voice-first AI sessions designed to calibrate your performance and
              fortify your narrative under pressure.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={AI_INTERVIEW_HISTORY_PATH} className={HEADER_ACTION_CLASS}>
              <Clock className="h-4 w-4 text-[var(--color-secondary)]" aria-hidden="true" />
              Session history
            </Link>
            <Link to={AI_INTERVIEW_ANALYTICS_PATH} className={HEADER_ACTION_CLASS}>
              <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
              Your progress
            </Link>
          </div>
        </motion.header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {ACTIVE_MODES.map((mode, index) => (
            <ActiveModeCard
              key={mode.slug}
              mode={mode}
              index={index}
              reduceMotion={reduceMotion}
              onNavigate={navigate}
            />
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[var(--color-on-surface-variant)]">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]/70" aria-hidden="true" />
            <h2 className="type-headline-md text-[var(--color-on-surface-variant)]">
              In Development
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {COMING_SOON_MODES.map((mode, index) => (
              <ComingSoonModeCard
                key={mode.slug}
                mode={mode}
                index={index}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
        </section>

        <footer className="flex items-center justify-center gap-2 text-center">
          <span className="h-2 w-2 rounded-full bg-[var(--color-tertiary-container)] animate-pulse" />
          <p className="type-label-sm text-[var(--color-outline)]">
            Powered by LiveKit transport for sub-100ms real-time voice feedback
          </p>
        </footer>
      </div>
    </div>
  );
}
