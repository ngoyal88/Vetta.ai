import React from "react";

type SilenceIndicatorProps = {
  tier: number;
  secondsSilent: number;
  tier3Seconds?: number;
};

export default function SilenceIndicator({
  tier,
  secondsSilent,
  tier3Seconds = 180,
}: SilenceIndicatorProps) {
  if (tier < 1) return null;

  const remaining = Math.max(0, tier3Seconds - secondsSilent);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const countdown = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-sm border border-[var(--border)] bg-[var(--bg-overlay)]"
      role="status"
      aria-live="polite"
    >
      <span className="w-[5px] h-[5px] rounded-full bg-amber-400" aria-hidden />
      <span className="font-mono text-[10px] text-[var(--text-secondary)]">
        Still listening — auto-end in {countdown}
      </span>
    </div>
  );
}
