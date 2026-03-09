import React from 'react';

export default function FeedbackCard({ feedback, scores, className = '' }) {
  return (
    <div
      className={`bg-raised border border-[var(--border-subtle)] px-6 py-4 rounded-2xl ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider mt-1">Feedback</span>
        <div className="flex-1">
          {scores && Object.keys(scores).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {scores.technical != null && (
                <span className="px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 text-xs">
                  Technical: {scores.technical}/10
                </span>
              )}
              {scores.communication != null && (
                <span className="px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 text-xs">
                  Communication: {scores.communication}/10
                </span>
              )}
              {scores.overall != null && (
                <span className="px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  Overall: {scores.overall}/10
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{feedback}</p>
        </div>
      </div>
    </div>
  );
}
