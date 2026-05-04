import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Target,
  Flame,
  FileSearch,
  Dice5,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import type { ModeCardDefinition } from "core/constants/interviewModes";

const ICON_MAP: Record<ModeCardDefinition["iconName"], LucideIcon> = {
  Target,
  Flame,
  FileSearch,
  Dice5,
  Users,
};

const SIDE_SHIFT_PX = 390;
const SIDE_SCALE = 0.78;
const SIDE_OPACITY = 0.48;
const SIDE_BLUR_PX = 8;
const SIDE_ROTATE_Y = 18;

const springTransition = {
  type: "spring" as const,
  stiffness: 220,
  damping: 28,
  mass: 0.9,
};

type ModesInfiniteCarouselProps = {
  modes: ModeCardDefinition[];
};

function getRelativeOffset(index: number, itemIndex: number, total: number) {
  if (total <= 1) return 0;

  let diff = itemIndex - index;
  diff = ((diff % total) + total) % total;

  if (diff > total / 2) diff -= total;

  return diff;
}

export function ModesInfiniteCarousel({ modes }: ModesInfiniteCarouselProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  const n = modes.length;
  const loop = n > 1;

  const goPrev = useCallback(() => {
    if (!loop) return;
    setIndex((i) => (i - 1 + n) % n);
  }, [loop, n]);

  const goNext = useCallback(() => {
    if (!loop) return;
    setIndex((i) => (i + 1) % n);
  }, [loop, n]);

  const handleDragEnd = useCallback(
    (
      _: MouseEvent | TouchEvent | PointerEvent,
      info: { offset: { x: number }; velocity: { x: number } }
    ) => {
      if (!loop) return;

      const swipe = info.offset.x + info.velocity.x * 0.2;

      if (swipe <= -56) goNext();
      if (swipe >= 56) goPrev();
    },
    [goNext, goPrev, loop]
  );

  useEffect(() => {
    if (n === 0) return;
    setIndex((i) => ((i % n) + n) % n);
  }, [n]);

  const visibleModes = useMemo(() => {
    if (n === 0) return [];

    return modes
      .map((mode, itemIndex) => {
        const offset = getRelativeOffset(index, itemIndex, n);
        return { mode, offset };
      })
      .filter(({ offset }) => n <= 3 || Math.abs(offset) <= 1);
  }, [modes, index, n]);

  if (reduceMotion) {
    return (
      <div className="flex flex-wrap justify-center gap-6 px-4 pb-8">
        {modes.map((mode) => (
          <div key={mode.slug} className="w-full max-w-[min(92vw,520px)] flex-[1_1_320px]">
            <ModeCard mode={mode} onEnter={() => navigate(mode.path)} reducedMotion isActive />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative w-full px-4 py-4 outline-none md:px-8 md:py-8"
      role="region"
      aria-roledescription="carousel"
      aria-label="Interview modes"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goPrev();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goNext();
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-4 left-0 z-[5] w-14 bg-gradient-to-r from-[var(--bg-0)] to-transparent md:inset-y-8 md:w-24"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-4 right-0 z-[5] w-14 bg-gradient-to-l from-[var(--bg-0)] to-transparent md:inset-y-8 md:w-24"
        aria-hidden
      />

      <button
        type="button"
        onClick={goPrev}
        disabled={!loop}
        aria-label="Previous mode"
        className="absolute left-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--bg-1)] text-[var(--cream-0)] transition-[opacity,background-color,border-color] duration-[120ms] ease-out hover:bg-[var(--bg-2)] disabled:pointer-events-none disabled:opacity-35 md:left-4 md:h-12 md:w-12"
      >
        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
      </button>

      <button
        type="button"
        onClick={goNext}
        disabled={!loop}
        aria-label="Next mode"
        className="absolute right-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--bg-1)] text-[var(--cream-0)] transition-[opacity,background-color,border-color] duration-[120ms] ease-out hover:bg-[var(--bg-2)] disabled:pointer-events-none disabled:opacity-35 md:right-4 md:h-12 md:w-12"
      >
        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" aria-hidden />
      </button>

      <motion.div
        className="relative mx-auto min-h-[540px] w-full max-w-[min(96vw,1240px)] overflow-hidden px-2 py-1 [perspective:1600px] md:min-h-[600px]"
        drag={loop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
      >
        <div className="relative h-[520px] w-full min-w-0 [transform-style:preserve-3d] md:h-[580px]">
          {visibleModes.map(({ mode, offset }) => {
            const isActive = offset === 0;
            const absOffset = Math.abs(offset);

            return (
              <motion.div
                key={mode.slug}
                className="absolute inset-0 flex items-center justify-center"
                initial={false}
                animate={{
                  x: offset * SIDE_SHIFT_PX,
                  scale: isActive ? 1 : SIDE_SCALE,
                  opacity: isActive ? 1 : SIDE_OPACITY,
                  rotateY: isActive ? 0 : offset < 0 ? SIDE_ROTATE_Y : -SIDE_ROTATE_Y,
                  filter: isActive ? "none" : `blur(${SIDE_BLUR_PX}px)`,
                }}
                transition={springTransition}
                style={{
                  zIndex: isActive ? 40 : 20 - absOffset,
                  transformStyle: "preserve-3d",
                  pointerEvents: isActive ? "auto" : "none",
                  willChange: "transform, filter",
                }}
                aria-hidden={!isActive}
              >
                <ModeCard mode={mode} onEnter={() => navigate(mode.path)} isActive={isActive} />
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <div className="mt-2 flex flex-col items-center gap-2 md:mt-4">
        <div className="flex justify-center gap-2">
          {modes.map((mode, i) => (
            <button
              key={mode.slug}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to ${mode.title}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-2 rounded-full transition-[width,background-color] duration-[120ms] ease-out ${
                i === index ? "w-8 bg-[var(--teal-2)]" : "w-2 bg-[var(--cream-4)] hover:bg-[var(--cream-3)]"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type ModeCardProps = {
  mode: ModeCardDefinition;
  onEnter: () => void;
  reducedMotion?: boolean;
  isActive?: boolean;
};

function ModeCard({ mode, onEnter, reducedMotion, isActive = true }: ModeCardProps) {
  const Icon = ICON_MAP[mode.iconName] ?? Target;

  return (
    <motion.article
      data-mode-card
      className={`relative flex w-full max-w-[min(84vw,780px)] min-w-0 flex-col overflow-hidden rounded-2xl border bg-[var(--bg-1)] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.18)] sm:p-8 lg:p-10 ${
        isActive ? "border-[var(--border)]" : "border-[var(--border)]/70"
      }`}
      initial={reducedMotion ? false : undefined}
      transition={{ duration: 0.2, ease: "easeOut" }}
      whileHover={
        reducedMotion || !isActive
          ? undefined
          : {
              y: -4,
              transition: { duration: 0.12, ease: "easeOut" },
            }
      }
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${
          isActive ? "bg-[var(--teal-2)]" : "bg-[var(--teal-2)]/60"
        }`}
        aria-hidden
      />

      {mode.comingSoon ? (
        <span className="absolute right-4 top-4 rounded-sm border border-[var(--amber-1)]/40 bg-[var(--bg-0)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--amber-1)]">
          Coming soon
        </span>
      ) : null}

      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded border border-[var(--teal-3)]/50 bg-[var(--bg-0)] text-[var(--teal-1)]">
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </div>

      <h3 className="text-xl font-medium tracking-tight text-[var(--cream-0)] md:text-2xl">{mode.title}</h3>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--teal-1)] md:text-[11px]">
        {mode.tagline}
      </p>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--cream-2)] md:text-[15px] md:leading-[1.65]">
        {mode.summary}
      </p>

      <ul className="mt-5 space-y-2 border-t border-[var(--border)] pt-5 font-mono text-[11px] leading-snug text-[var(--cream-3)]">
        {mode.highlights.map((line) => (
          <li key={line.slice(0, 24)} className="flex gap-2">
            <span className="text-[var(--teal-1)]" aria-hidden>
              -
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onEnter}
        className="btn-cyan mt-6 inline-flex h-10 w-full items-center justify-center gap-2 text-sm font-medium"
      >
        Enter mode
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      {mode.comingSoon ? (
        <p className="mt-3 text-center font-mono text-[10px] text-[var(--cream-4)]">
          Opens setup - live session polish in progress
        </p>
      ) : null}
    </motion.article>
  );
}