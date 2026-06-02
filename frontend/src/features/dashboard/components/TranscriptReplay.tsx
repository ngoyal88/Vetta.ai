import React from 'react';
import { useReducedMotion } from 'framer-motion';

import type { TranscriptLine } from 'shared/services/api';

type TranscriptReplayProps = {
  lines: TranscriptLine[];
  className?: string;
  variant?: 'default' | 'history';
};

const TranscriptReplay: React.FC<TranscriptReplayProps> = ({
  lines,
  className,
  variant = 'default',
}) => {
  const reduceMotion = useReducedMotion();

  if (!lines.length) {
    return (
      <p className="text-sm text-[var(--cream-4)]">Transcript not available for this session.</p>
    );
  }

  const isHistory = variant === 'history';
  const containerClass = [
    'max-h-[400px] space-y-2 overflow-y-auto rounded-sm border p-3',
    isHistory
      ? 'border-white/5 bg-[var(--color-surface-container-lowest)]'
      : 'border-[var(--border)] bg-[var(--bg-1)]',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
      {lines.map((line, index) => {
        const isCandidate = line.speaker === 'candidate';
        return (
          <div
            key={`${line.timestamp || 't'}-${index}`}
            className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-sm border px-3 py-2 text-sm leading-relaxed ${
                isCandidate
                  ? isHistory
                    ? 'border-[var(--color-tertiary)]/30 bg-[var(--color-tertiary)]/10 text-[var(--color-on-surface)]'
                    : 'border-[var(--teal-2)] bg-[var(--emerald-dim)] text-[var(--cream-1)]'
                  : isHistory
                    ? 'border-white/5 bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]'
                    : 'border-[var(--border)] bg-[var(--bg-2)] text-[var(--cream-2)]'
              }`}
            >
              <p
                className={`mb-1 font-mono text-[9px] uppercase tracking-wider ${
                  isHistory ? 'text-[var(--color-outline)]' : 'text-[var(--cream-4)]'
                }`}
              >
                {isCandidate ? 'You' : 'Interviewer'}
                {line.timestamp && !reduceMotion ? (
                  <span className="ml-2 normal-case tracking-normal opacity-70">
                    {new Date(line.timestamp).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : null}
              </p>
              <p>{line.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TranscriptReplay;
