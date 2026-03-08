import React, { useEffect, useRef } from 'react';

function Modal({ open, onClose, title, children, className = '' }) {
  const panelRef = useRef(null);
  const previousActiveRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement;

    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0];
    if (first) first.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const list = [...focusable];
      const idx = list.indexOf(document.activeElement);
      if (idx === -1) return;
      if (e.shiftKey) {
        const next = idx <= 0 ? list[list.length - 1] : list[idx - 1];
        next?.focus();
        e.preventDefault();
      } else {
        const next = idx >= list.length - 1 ? list[0] : list[idx + 1];
        next?.focus();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveRef.current?.focus) previousActiveRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={panelRef}
        className={`bg-gray-900 border border-cyan-600/30 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id="modal-title" className="text-lg font-semibold text-white px-6 pt-6 pb-2">
            {title}
          </h2>
        )}
        <div className={title ? 'px-6 pb-6' : 'p-6'}>{children}</div>
      </div>
    </div>
  );
}

export default Modal;
