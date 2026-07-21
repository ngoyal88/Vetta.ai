import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-overlay)]/40 px-6 py-12 text-center ${className}`}
    >
      <h3 className="type-headline-sm text-[var(--color-on-surface)]">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-[var(--color-outline)]">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
