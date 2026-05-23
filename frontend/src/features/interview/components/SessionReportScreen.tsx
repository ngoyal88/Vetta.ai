import React from "react";
import { ChevronRight } from "lucide-react";
import FeedbackCard from "features/interview/components/FeedbackCard";
import type { FeedbackPayload } from "features/interview/types";
import { getSessionReportSubtitle } from "features/interview/utils/sessionReportUtils";

type SessionReportScreenProps = {
  feedback: FeedbackPayload | string | null;
  onBack: () => void;
};

export default function SessionReportScreen({ feedback, onBack }: SessionReportScreenProps) {
  const completionReason =
    typeof feedback === "object" && feedback?.completion_reason
      ? String(feedback.completion_reason)
      : "";
  const hasFeedback =
    typeof feedback === "string"
      ? feedback.length > 0
      : Boolean(feedback?.feedback);
  const subtitle = getSessionReportSubtitle(completionReason, hasFeedback);

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      <header className="h-11 shrink-0 px-4 flex items-center border-b border-[var(--border)] bg-raised">
        <div className="filepath">
          <span className="segment">~/interviews</span>
          <span className="sep">/</span>
          <span className="active-segment">session-report</span>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-4">
            Session complete
          </p>
          <h1 className="text-xl font-semibold text-white mb-1">Interview report</h1>
          <p className="text-xs text-[var(--text-secondary)] mb-6">{subtitle}</p>
          {hasFeedback ? (
            <FeedbackCard
              feedback={typeof feedback === "string" ? feedback : feedback?.feedback ?? ""}
              scores={
                typeof feedback === "object" && feedback?.full && typeof feedback.full === "object"
                  ? (feedback.full as { scores?: unknown }).scores
                  : undefined
              }
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="w-8 h-8 border border-indigo/30 border-t-indigo rounded-sm animate-spin" />
              <p className="font-mono text-xs text-[var(--text-tertiary)]">
                {"// Analyzing session data…"}
              </p>
            </div>
          )}
        </div>
      </div>
      <footer className="h-14 shrink-0 px-6 flex items-center border-t border-[var(--border)] bg-raised">
        <button type="button" onClick={onBack} className="btn-ghost text-xs flex items-center gap-1.5">
          <ChevronRight size={12} className="rotate-180" />
          {hasFeedback ? "Back to dashboard" : "Back without waiting"}
        </button>
      </footer>
    </div>
  );
}
