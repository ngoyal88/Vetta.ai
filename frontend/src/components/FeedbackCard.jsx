import React from 'react';

export default function FeedbackCard({ feedback, scores, className = '' }) {
  return (
    <div
      className={`bg-green-500/10 border border-green-500/30 backdrop-blur-md px-6 py-4 rounded-2xl ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xs font-bold text-green-400 uppercase mt-1">Feedback</span>
        <div className="flex-1">
          {scores && Object.keys(scores).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {scores.technical != null && (
                <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 text-xs">
                  Technical: {scores.technical}/10
                </span>
              )}
              {scores.communication != null && (
                <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 text-xs">
                  Communication: {scores.communication}/10
                </span>
              )}
              {scores.overall != null && (
                <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 text-xs font-medium">
                  Overall: {scores.overall}/10
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-green-100 whitespace-pre-wrap">{feedback}</p>
        </div>
      </div>
    </div>
  );
}
