import { ArrowRight, Lock } from "lucide-react";

import FeedbackCard from "features/interview/report/FeedbackCard";
import { ProfileClaimsReview } from "features/interview/report/ProfileClaimsReview";
import type { FeedbackPayload } from "features/interview/types";
import {
  formatDurationMinutes,
  getSessionReportModeLabel,
  getSessionReportSubtitle,
} from "features/interview/report/sessionReportUtils";
import "features/interview/report/session-report.css";

type Props = {
  feedback: FeedbackPayload | string | null;
  sessionId?: string;
  sessionLabel?: string;
  onBack: () => void;
};

function normalizeFeedback(feedback: Props["feedback"]) {
  if (typeof feedback === "string") {
    return {
      text: feedback,
      full: undefined as unknown,
      reason: "",
      durationMinutes: null as number | null,
      questionsAnswered: null as number | null,
      codeProblems: null as number | null,
    };
  }
  return {
    text: feedback?.feedback ?? "",
    full: feedback?.full,
    reason: feedback?.completion_reason ? String(feedback.completion_reason) : "",
    durationMinutes: feedback?.duration_minutes ?? null,
    questionsAnswered: feedback?.questions_answered ?? null,
    codeProblems: feedback?.code_problems_attempted ?? null,
  };
}

export default function SessionReportScreen({
  feedback,
  sessionId,
  sessionLabel,
  onBack,
}: Props) {
  const normalized = normalizeFeedback(feedback);
  const hasFeedback = Boolean(normalized.text);
  const subtitle = getSessionReportSubtitle(normalized.reason, hasFeedback);
  const modeLabel =
    sessionLabel ||
    getSessionReportModeLabel(
      sessionId ? sessionStorage.getItem(`interview_type_${sessionId}`) : null,
    );

  const duration = formatDurationMinutes(normalized.durationMinutes);
  const showMetrics =
    hasFeedback &&
    (duration != null ||
      normalized.questionsAnswered != null ||
      normalized.codeProblems != null);

  return (
    <div className="sr-page">
      <header className="sr-header">
        <div className="sr-header__inner">
          <div className="sr-brand">
            <span className="sr-brand__name">vetta.ai</span>
            <span className="sr-brand__divider" aria-hidden />
            <div className="sr-brand__meta">
              <span className="sr-brand__eyebrow">Session Finished</span>
              <span className="sr-brand__title">{modeLabel}</span>
            </div>
          </div>
          <div className="sr-secure">
            <Lock size={14} aria-hidden />
            <span className="sr-secure__label">Secure Wrap-up Complete</span>
          </div>
        </div>
      </header>

      <main className="sr-main">
        <div className="sr-content">
          <div className="sr-hero">
            <h1 className="sr-hero__title">Interview Report</h1>
            <p className="sr-hero__subtitle">{subtitle}</p>
          </div>

          {!hasFeedback ? (
            <div className="sr-loading" role="status" aria-live="polite">
              <div className="sr-loading__spinner" aria-hidden />
              <p className="sr-loading__text">Generating report — this takes a moment.</p>
            </div>
          ) : (
            <>
              {showMetrics ? (
                <div className="sr-metrics">
                  {duration != null ? (
                    <div className="sr-metric">
                      <span className="sr-metric__label">Duration</span>
                      <span className="sr-metric__value">
                        {duration}
                        <span className="sr-metric__unit">min</span>
                      </span>
                    </div>
                  ) : null}
                  {normalized.questionsAnswered != null ? (
                    <div className="sr-metric">
                      <span className="sr-metric__label">Questions Answered</span>
                      <span className="sr-metric__value">{normalized.questionsAnswered}</span>
                    </div>
                  ) : null}
                  {normalized.codeProblems != null ? (
                    <div className="sr-metric">
                      <span className="sr-metric__label">Code Problems</span>
                      <span className="sr-metric__value">{normalized.codeProblems}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <FeedbackCard feedback={normalized.text} full={normalized.full} />
              <ProfileClaimsReview sessionId={sessionId} />
            </>
          )}
        </div>
      </main>

      <footer className="sr-footer">
        <div className="sr-footer__inner">
          <button type="button" className="sr-btn sr-btn--cta" onClick={onBack}>
            <span>{hasFeedback ? "Back to Dashboard" : "Back without waiting"}</span>
            <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </footer>
    </div>
  );
}
