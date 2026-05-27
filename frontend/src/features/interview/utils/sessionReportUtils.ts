export type CompletionReason =
  | "user_ended"
  | "silence_timeout"
  | "tab_away_timeout"
  | "candidate_disconnected"
  | "max_duration"
  | "ended_early"
  | "completed"
  | "error"
  | string;

export function getSessionReportSubtitle(
  reason?: string | null,
  hasFeedback?: boolean
): string {
  if (!hasFeedback && !reason) {
    return "Generating report — this takes a moment.";
  }
  const r = (reason || "").toLowerCase();
  switch (r) {
    case "user_ended":
      return "You ended the session.";
    case "silence_timeout":
      return "Ended — no speech detected for 3 minutes.";
    case "tab_away_timeout":
      return "Ended — you were away for 10+ minutes.";
    case "candidate_disconnected":
      return "Ended — connection lost.";
    case "max_duration":
      return "Time limit reached.";
    case "error":
      return "Ended due to a service issue.";
    case "completed":
    case "ended_early":
      return hasFeedback ? "Analysis complete." : "Generating report — this takes a moment.";
    default:
      return hasFeedback ? "Analysis complete." : "Generating report — this takes a moment.";
  }
}
