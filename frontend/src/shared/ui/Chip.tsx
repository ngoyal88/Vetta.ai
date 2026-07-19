import type { ReactNode } from "react";

type ChipProps = {
  children: ReactNode;
  className?: string;
};

export function Chip({ children, className = "" }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-2.5 py-0.5 text-xs text-[var(--color-on-surface-variant)] ${className}`}
    >
      {children}
    </span>
  );
}
