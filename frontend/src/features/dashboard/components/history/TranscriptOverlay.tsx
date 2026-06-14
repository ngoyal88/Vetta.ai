import React from 'react';
import { X } from 'lucide-react';

import type { InterviewHistoryItem } from 'shared/services/api';

type TranscriptOverlayProps = {
  interview: InterviewHistoryItem;
  srcDoc: string;
  onClose: () => void;
};

export function TranscriptOverlay({ interview, srcDoc, onClose }: TranscriptOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-end bg-[var(--color-surface)]/80 p-0 backdrop-blur-sm md:justify-center md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Full session transcript"
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-white/15 bg-[var(--color-surface-container-lowest)] shadow-[0_0_40px_rgba(59,130,246,0.2)] md:h-[921px] md:max-h-[90vh] md:w-[800px] md:rounded-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-on-surface-variant)]">
              Transcript viewer
            </p>
            <h2 className="truncate text-sm font-semibold text-[var(--color-on-surface)] sm:text-base">
              {interview.target_role || interview.custom_role || 'Session Transcript'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--color-on-surface-variant)] transition-colors hover:bg-white/10 hover:text-[var(--color-on-surface)]"
            aria-label="Close transcript viewer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <iframe title="Session transcript" srcDoc={srcDoc} className="h-full w-full border-0" />
      </div>
    </div>
  );
}
