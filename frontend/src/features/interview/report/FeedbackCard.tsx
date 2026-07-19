import { extractReportScores, formatScore } from "features/interview/report/sessionReportUtils";
import "features/interview/report/session-report.css";

type Props = {
  feedback: string;
  full?: unknown;
};

export default function FeedbackCard({ feedback, full }: Props) {
  const scores = extractReportScores(full);
  const technical = formatScore(scores?.technical);
  const communication = formatScore(scores?.communication);
  const overall = formatScore(scores?.overall);

  return (
    <section className="sr-summary" aria-labelledby="sr-performance-title">
      <div className="sr-summary__glow" aria-hidden />
      <h2 id="sr-performance-title" className="sr-summary__title">
        Performance Summary
      </h2>
      <p className="sr-summary__body">{feedback}</p>
      {(technical || communication || overall) && (
        <div className="sr-scores">
          {technical && (
            <div className="sr-score">
              <span className="sr-score__label">Technical</span>
              <span className="sr-score__sep" aria-hidden />
              <span className="sr-score__value sr-score__value--secondary">{technical}</span>
            </div>
          )}
          {communication && (
            <div className="sr-score">
              <span className="sr-score__label">Communication</span>
              <span className="sr-score__sep" aria-hidden />
              <span className="sr-score__value sr-score__value--primary">{communication}</span>
            </div>
          )}
          {overall && (
            <div className="sr-score">
              <span className="sr-score__label">Overall Fit</span>
              <span className="sr-score__sep" aria-hidden />
              <span className="sr-score__value sr-score__value--tertiary">{overall}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
