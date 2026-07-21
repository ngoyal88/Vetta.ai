import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Braces,
  Bug,
  Code2,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Mic,
  Network,
  Play,
  Rocket,
  SlidersHorizontal,
  Target,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PreSessionCheckerWithBrowserCheck } from "features/interview/preflight/PreSessionChecker";
import { SetupProgressSteps } from "features/modes/shared/components/SetupProgressSteps";
import { getCardMotion, getHeaderMotion } from "features/modes/shared/utils/motion";
import { PAIR_TRACKS, type PairTrackId } from "../tracks";
import { usePairProgrammingSetup } from "../hooks/usePairProgrammingSetup";

const SECTION_ICON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border";

const TRACK_ICONS: Record<PairTrackId, React.ReactNode> = {
  dsa: <Braces className="h-5 w-5" aria-hidden />,
  lld: <Network className="h-5 w-5" aria-hidden />,
  bugfix: <Bug className="h-5 w-5" aria-hidden />,
};

const DIFFICULTY_BLURBS: Record<number, string> = {
  1: "Warm-up problems with clear constraints — great for getting comfortable in the IDE.",
  2: "Standard coding-round difficulty — explain as you go and aim for a clean pass.",
  3: "Interview-hard problems that reward clean structure and edge-case thinking.",
};

const PairProgrammingPage: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const setup = usePairProgrammingSetup();

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden pb-16 pt-10">
      {setup.showPreCheck && setup.preCheckSessionId ? (
        <PreSessionCheckerWithBrowserCheck
          sessionId={setup.preCheckSessionId}
          getAuthToken={() => setup.currentUser?.getIdToken?.()}
          onAllPassed={setup.completePreCheck}
          onCancel={setup.dismissPreCheck}
        />
      ) : null}

      <div
        className="pointer-events-none absolute -top-20 left-1/4 h-[320px] w-[320px] rounded-full bg-[var(--color-primary)]/10 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-1/4 h-[280px] w-[280px] rounded-full bg-[var(--color-tertiary)]/10 blur-[140px]"
        aria-hidden
      />

      <div className="app-container relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8">
        <motion.header {...getHeaderMotion(reduceMotion)} className="flex flex-col gap-6">
          <Link
            to="/ai-interview"
            className="inline-flex w-fit items-center gap-2 type-label-sm text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50 rounded-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to All interview modes
          </Link>

          <div className="flex flex-col gap-5 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
                AI Interview
              </p>
              <h1 className="type-headline-lg mt-2 text-balance text-[var(--color-on-surface)] md:type-display-lg">
                Pair Programming Setup
              </h1>
              <p className="type-body-md mt-3 text-pretty text-[var(--color-on-surface-variant)]">
                Live coding and algorithmic problem solving with an AI collaborator.
              </p>
            </div>

            <SetupProgressSteps activeStep={1} />
          </div>
        </motion.header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <motion.section
              {...getCardMotion(reduceMotion, 0)}
              className="glass-panel rounded-2xl p-5 md:p-6"
              aria-labelledby="pair-track-heading"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`${SECTION_ICON} border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 text-[var(--color-primary)]`}
                >
                  <Layers className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2
                    id="pair-track-heading"
                    className="type-headline-md text-[var(--color-on-surface)]"
                  >
                    Track selection
                  </h2>
                  <p className="type-body-sm mt-1 text-[var(--color-on-surface-variant)]">
                    Choose the domain for your technical interview.
                  </p>
                </div>
              </div>

              <div
                className="mt-5 flex flex-col gap-3"
                role="radiogroup"
                aria-labelledby="pair-track-heading"
              >
                {PAIR_TRACKS.map((item) => {
                  const selected = setup.track === item.id;
                  const disabled = !item.live;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => setup.setTrack(item.id)}
                      className={`flex w-full items-start gap-4 rounded-xl border px-4 py-4 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/45 ${
                        selected
                          ? "border-[var(--color-primary)]/60 bg-[var(--color-primary)]/10 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]"
                          : "border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/40 hover:border-[var(--color-outline-variant)]/50"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                          selected
                            ? "border-[var(--color-primary)]/40 bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-2)] text-[var(--color-on-surface-variant)]"
                        }`}
                      >
                        {TRACK_ICONS[item.id]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="type-title-sm text-[var(--color-on-surface)]">
                            {item.title}
                          </span>
                          {!item.live ? (
                            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-0)]/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-on-surface-variant)]">
                              Coming soon
                            </span>
                          ) : (
                            <span className="rounded-full border border-[var(--color-tertiary)]/30 bg-[var(--color-tertiary)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-tertiary)]">
                              Live
                            </span>
                          )}
                        </span>
                        <span className="type-body-sm mt-1.5 block text-pretty text-[var(--color-on-surface-variant)]">
                          {item.description}
                        </span>
                      </span>
                      <span
                        className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          selected
                            ? "border-[var(--color-primary)]"
                            : "border-[var(--color-outline-variant)]"
                        }`}
                        aria-hidden
                      >
                        {selected ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            <motion.section
              {...getCardMotion(reduceMotion, 0.06)}
              className="glass-panel rounded-2xl p-5 md:p-6"
              aria-labelledby="pair-difficulty-heading"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`${SECTION_ICON} border-[var(--color-tertiary)]/25 bg-[var(--color-tertiary)]/10 text-[var(--color-tertiary)]`}
                >
                  <SlidersHorizontal className="h-5 w-5" aria-hidden />
                </div>
                <h2
                  id="pair-difficulty-heading"
                  className="type-headline-md text-[var(--color-on-surface)]"
                >
                  Difficulty caliber
                </h2>
              </div>

              <div className="range-slider-field mt-5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="pair-difficulty-slider"
                    className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]"
                  >
                    Problem intensity
                  </label>
                  <span className="inline-flex items-center rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-1 font-mono text-xs leading-none text-[var(--color-primary)]">
                    {setup.difficultyLabel}
                  </span>
                </div>
                <input
                  id="pair-difficulty-slider"
                  type="range"
                  min={1}
                  max={setup.difficultyStops.length}
                  step={1}
                  value={setup.difficultyValue}
                  onChange={(e) => setup.setDifficultyValue(Number(e.target.value))}
                  className="range-slider"
                  style={{ ["--slider-progress" as string]: setup.difficultyProgress }}
                  aria-valuemin={1}
                  aria-valuemax={setup.difficultyStops.length}
                  aria-valuenow={setup.difficultyValue}
                  aria-valuetext={setup.difficultyLabel}
                />
                <div className="flex justify-between type-label-sm text-[var(--color-outline)]">
                  {setup.difficultyStops.map((stop) => (
                    <span
                      key={stop.value}
                      className={
                        stop.value === setup.difficultyValue
                          ? "text-[var(--color-primary)]"
                          : undefined
                      }
                    >
                      {stop.stopLabel}
                    </span>
                  ))}
                </div>
              </div>
              <p className="type-body-sm mt-4 text-pretty text-[var(--color-on-surface-variant)]">
                {DIFFICULTY_BLURBS[setup.difficultyValue] ?? DIFFICULTY_BLURBS[2]}
              </p>
            </motion.section>

            <motion.section
              {...getCardMotion(reduceMotion, 0.12)}
              className="glass-panel rounded-2xl p-5 md:p-6"
              aria-labelledby="pair-focus-heading"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`${SECTION_ICON} border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]`}
                >
                  <Target className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2
                    id="pair-focus-heading"
                    className="type-headline-md text-[var(--color-on-surface)]"
                  >
                    Session focus
                    <span className="ml-2 type-label-sm font-normal normal-case tracking-normal text-[var(--color-on-surface-variant)]">
                      Optional
                    </span>
                  </h2>
                  <p className="type-body-sm mt-1 text-[var(--color-on-surface-variant)]">
                    Steer problem selection toward topics you want to practice.
                  </p>
                </div>
              </div>

              <label htmlFor="pair-session-focus" className="sr-only">
                Session focus topics
              </label>
              <input
                id="pair-session-focus"
                name="session_focus"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={setup.focusText}
                onChange={(e) => setup.setFocusText(e.target.value)}
                placeholder="Dynamic Programming, Trees, Sliding Window…"
                className="mt-5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/50 px-4 py-3 type-body-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--color-primary)]/50 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
              />
              <div className="mt-3 flex flex-wrap gap-2.5" role="group" aria-label="Topic chips">
                {setup.focusChipOptions.map((chip) => {
                  const on = setup.focusChips.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setup.toggleFocusChip(chip)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 type-label-sm transition-[border-color,background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/45 ${
                        on
                          ? "border-[var(--color-tertiary)] bg-[var(--color-tertiary-container)]/20 text-[var(--color-tertiary)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-tertiary)_35%,transparent)]"
                          : "border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/40 text-[var(--color-on-surface-variant)] hover:border-[var(--color-outline-variant)]/50 hover:text-[var(--color-on-surface)]"
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          </div>

          <motion.aside
            {...getCardMotion(reduceMotion, 0.08)}
            className="glass-panel flex h-fit flex-col gap-5 rounded-2xl p-5 md:p-6 lg:sticky lg:top-24"
            aria-labelledby="pair-expectations-heading"
          >
            <div className="flex items-center gap-3">
              <div
                className={`${SECTION_ICON} border-[var(--color-tertiary)]/25 bg-[var(--color-tertiary)]/10 text-[var(--color-tertiary)]`}
              >
                <Code2 className="h-5 w-5" aria-hidden />
              </div>
              <h2
                id="pair-expectations-heading"
                className="type-headline-md text-[var(--color-on-surface)]"
              >
                What to expect
              </h2>
            </div>

            <ul className="flex flex-col gap-3.5">
              {(
                [
                  [Mic, "Speak through your approach before you dive into code."],
                  [Wrench, "Write in the live IDE with syntax highlighting and starters."],
                  [Play, "Run visible test cases and iterate on failures."],
                  [MessageSquare, "Get light pair-coaching from the AI collaborator."],
                ] as const
              ).map(([Icon, text]) => (
                <li
                  key={text}
                  className="flex items-start gap-3 type-body-sm text-pretty text-[var(--color-on-surface-variant)]"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            <div
              className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-0)]/80"
              aria-hidden
            >
              <div className="flex border-b border-[var(--border-subtle)] font-mono text-[10px] uppercase tracking-[0.08em]">
                <span className="flex-1 px-3 py-2.5 text-[var(--color-primary)]">Problem</span>
                <span className="flex-1 border-l border-[var(--border-subtle)] px-3 py-2.5 text-[var(--color-on-surface-variant)]">
                  Editor
                </span>
                <span className="flex-1 border-l border-[var(--border-subtle)] px-3 py-2.5 text-[var(--color-on-surface-variant)]">
                  Chat
                </span>
              </div>
              <div className="space-y-2 p-3.5 font-mono text-[11px] leading-relaxed text-[var(--color-on-surface-variant)]">
                <p className="text-[var(--color-on-surface)]">def two_sum(nums, target):</p>
                <p className="opacity-80">… # talk through tradeoffs</p>
                <p className="text-[var(--color-primary)]"># Run tests → iterate</p>
              </div>
            </div>
          </motion.aside>
        </div>

        <footer className="flex flex-col items-center gap-3 border-t border-[var(--border-subtle)] pt-8">
          <button
            type="button"
            onClick={() => void setup.handleStartInterview()}
            disabled={!setup.canLaunch}
            aria-busy={setup.starting}
            className="flex w-full max-w-md items-center justify-center gap-3 rounded-xl bg-[var(--color-primary-container)] px-6 py-3.5 text-base font-semibold text-[var(--color-on-primary-container)] shadow-luminous transition-[background-color,color,opacity] duration-150 hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {setup.starting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Starting…
              </>
            ) : (
              <>
                Continue to Pre-check
                <Rocket className="h-5 w-5" aria-hidden />
              </>
            )}
          </button>
          <p className="type-label-sm text-center text-[var(--color-on-surface-variant)]">
            Ready when you are — we&apos;ll verify mic, speaker, and connection next.
          </p>
          <p className="flex items-center gap-2 type-label-sm text-[var(--color-outline)]">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            Session is private and encrypted
          </p>
        </footer>
      </div>
    </div>
  );
};

export default PairProgrammingPage;
