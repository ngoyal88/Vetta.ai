import React, { useEffect } from "react";
import { X } from "lucide-react";

const BANNER_STYLES = {
  info: "bg-blue-500/10 border-blue-500/30 text-blue-300",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  error: "bg-red-500/10 border-red-500/30 text-red-300",
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
};

export function SessionBanner({ type, message, onDismiss, autoDismissMs }) {
  useEffect(() => {
    if (autoDismissMs && onDismiss) {
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      className={`
      flex items-center justify-between gap-3 px-4 py-2.5 
      border rounded-lg text-sm mx-4 mt-2
      ${BANNER_STYLES[type] ?? BANNER_STYLES.info}
    `}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="opacity-60 hover:opacity-100 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
