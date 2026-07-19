import { getModeLabel } from "features/interview/domain/modeContract";

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

export type ReportScores = {
  technical?: number | null;
  communication?: number | null;
  overall?: number | null;
};

export function getSessionReportSubtitle(
  reason?: string | null,
  hasFeedback?: boolean,
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

/** Human label for sessionStorage `interview_type_*` keys. */
export function getSessionReportModeLabel(storedType?: string | null): string {
  return getModeLabel(storedType);
}

export function extractReportScores(full: unknown): ReportScores | null {
  if (!full || typeof full !== "object") return null;
  const scores = (full as { scores?: unknown }).scores;
  if (!scores || typeof scores !== "object") return null;
  const s = scores as ReportScores;
  if (s.technical == null && s.communication == null && s.overall == null) return null;
  return s;
}

export function formatScore(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${pretty}/10`;
}

export function formatDurationMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  return String(Math.round(minutes));
}
