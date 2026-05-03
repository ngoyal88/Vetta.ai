import React from "react";

import { MODE_CARDS } from "core/constants/interviewModes";
import { ModesInfiniteCarousel } from "features/modes/components/modes-infinite-carousel";

const ModesPage: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-[var(--bg-0)] py-12 text-[var(--cream-1)]">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(91, 189, 170, 0.06) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-[1] mx-auto max-w-[1200px] px-6 pb-8 pt-6 md:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--teal-1)]">
          Modes
        </p>

        <h1 className="mt-3 max-w-3xl text-2xl font-medium tracking-tight text-[var(--cream-0)] md:text-3xl">
          Pick how you want to be interviewed
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--cream-2)]">
          One mode is in focus at a time—the rest sit back in depth. Use the side
          arrows or keyboard when the carousel is focused; open a mode from the
          forward card when you are ready to configure a session.
        </p>
      </header>

      {/* Carousel Section (FIXED CENTERING) */}
      <section className="relative z-[1] mx-auto min-h-[62vh] max-w-[1200px] flex items-center justify-center">
        <ModesInfiniteCarousel modes={MODE_CARDS} />
      </section>

      {/* Footer */}
      <footer className="relative z-[1] mx-auto max-w-[1200px] px-6 pt-6 md:px-10">
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-1)] px-5 py-4 font-mono text-[11px] leading-relaxed text-[var(--cream-3)] md:flex md:items-start md:justify-between md:gap-8">
          <span className="block text-[var(--cream-4)]">
            SESSION_TYPES · VETTA_CORE
          </span>

          <span className="mt-2 block md:mt-0 md:max-w-xl md:text-right">
            Voice-first sessions · hiring-signal feedback
          </span>
        </div>
      </footer>
    </div>
  );
};

export default ModesPage;