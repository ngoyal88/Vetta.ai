import React from "react";

const ResumeDeepDivePage: React.FC = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg-0)] px-6 text-[var(--cream-1)]">
      {/* subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(91, 189, 170, 0.06) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden
      />

      <div className="relative z-[1] w-full max-w-[720px] rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:p-10">
        {/* header */}
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--teal-1)]">
          Mode · Resume Deep Dive
        </p>

        <h1 className="mt-3 text-2xl font-medium tracking-tight text-[var(--cream-0)] md:text-3xl">
          Coming soon
        </h1>

        {/* description */}
        <p className="mt-4 text-sm leading-relaxed text-[var(--cream-2)] md:text-[15px]">
          This mode analyzes your résumé and turns it into a structured interview.
          Every claim is probed—decisions, tradeoffs, impact, and what you would do differently.
          It focuses on depth, not surface-level storytelling.
        </p>

        {/* divider */}
        <div className="mt-6 border-t border-[var(--border)] pt-6" />

        {/* features */}
        <ul className="space-y-2 font-mono text-[11px] text-[var(--cream-3)]">
          <li>- Deep questioning on every project and experience</li>
          <li>- Focus on metrics, impact, and real ownership</li>
          <li>- Follow-ups that expose shallow understanding</li>
          <li>- Structured behavioral + technical probing</li>
        </ul>

        {/* footer note */}
        <p className="mt-6 text-center font-mono text-[10px] text-[var(--cream-4)]">
          Work in progress · built for real hiring signal
        </p>
      </div>
    </div>
  );
};

export default ResumeDeepDivePage;