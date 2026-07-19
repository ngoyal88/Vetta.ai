import type { ReactNode } from "react";

type SectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <p
      className={`type-label-sm uppercase tracking-[0.12em] text-[var(--color-outline)] ${className}`}
    >
      {children}
    </p>
  );
}
