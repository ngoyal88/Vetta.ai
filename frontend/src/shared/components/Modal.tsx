import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  children,
  className = '',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusable?.[0];
    if (first) first.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusableNodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const list = Array.from(focusableNodes);
      const currentIndex = list.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) return;

      if (event.shiftKey) {
        const next = currentIndex <= 0 ? list[list.length - 1] : list[currentIndex - 1];
        next?.focus();
        event.preventDefault();
      } else {
        const next = currentIndex >= list.length - 1 ? list[0] : list[currentIndex + 1];
        next?.focus();
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(2,6,23,0.72)] p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onClick={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <div
        ref={panelRef}
        className={`glass-panel max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-surface-container)]/92 shadow-[0_24px_80px_rgba(2,6,23,0.48)] ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <div className="border-b border-[var(--border-subtle)] px-6 pb-3 pt-6">
            <h2 id={titleId} className="type-headline-md text-[var(--color-on-surface)]">
              {title}
            </h2>
          </div>
        ) : null}
        <div className={title ? 'px-6 pb-6 pt-5' : 'p-6'}>{children}</div>
      </div>
    </div>
  );
}
