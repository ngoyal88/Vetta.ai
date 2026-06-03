import React from 'react';
import {
  Bolt,
  Brain,
  ExternalLink,
  FileDown,
  MessageSquare,
  RotateCcw,
  Trash2,
  TrendingUp,
} from 'lucide-react';

import type { InterviewHistoryItem, TranscriptLine } from 'shared/services/api';
import { parseFeedback } from '../../utils/interviewHistoryUtils';
import {
  formatSessionIdLabel,
  getDetailPanelTitle,
  truncateHighlightTitle,
} from '../../utils/historyPresentationUtils';

type SessionHistoryDetailPanelProps = {
  interview: InterviewHistoryItem | null;
  onOpenFullTranscript: () => void;
  onPracticeAgain: () => void;
  onDelete: () => void;
  isPracticing: boolean;
  isDeleting: boolean;
  canPracticeAgain: boolean;
};

function getTranscriptSnippet(lines: TranscriptLine[]): {
  aiLine?: TranscriptLine;
  candidateLine?: TranscriptLine;
} {
  const aiLine = lines.find((line) => line.speaker !== 'candidate');
  const candidateLine = lines.find((line) => line.speaker === 'candidate');
  return { aiLine, candidateLine };
}

function SessionHistoryDetailPanelComponent({
  interview,
  onOpenFullTranscript,
  onPracticeAgain,
  onDelete,
  isPracticing,
  isDeleting,
  canPracticeAgain,
}: SessionHistoryDetailPanelProps) {
  if (!interview) {
    return (
      <div className="history-detail-panel history-detail-panel--empty">
        <MessageSquare className="mb-3 h-8 w-8 text-[var(--color-on-surface-variant)]" aria-hidden />
        <p className="type-body-md text-[var(--color-on-surface-variant)]">
          Select a session to view the intelligence report.
        </p>
      </div>
    );
  }

  const { text: feedbackText } = parseFeedback(interview);
  const highlights = interview.replay_highlights || [];
  const transcript = interview.live_transcription || [];
  const snippet = getTranscriptSnippet(transcript);
  const primaryHighlight = highlights[0];
  const secondaryHighlight = highlights[1];

  return (
    <div className="history-detail-panel">
      <div className="history-detail-panel__header">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="history-detail-panel__badge">INTELLIGENCE REPORT</span>
            <span className="history-detail-panel__id">{formatSessionIdLabel(interview)}</span>
          </div>
          <h3 className="history-detail-panel__title">{getDetailPanelTitle(interview)}</h3>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1.5 text-[var(--color-on-surface-variant)] transition-colors hover:bg-white/5 hover:text-[var(--color-on-surface)]"
          aria-label="Open report in new view"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="history-detail-panel__scroll">
        <section className="history-detail-panel__section">
          <h4 className="history-detail-panel__section-title">
            <Bolt className="h-4 w-4" aria-hidden />
            Session Highlights
          </h4>
          <div className="history-highlight-grid">
            <div className="history-highlight-card history-highlight-card--positive">
              <div className="history-highlight-card__label">
                <Bolt className="h-4 w-4" aria-hidden />
                {primaryHighlight
                  ? truncateHighlightTitle(primaryHighlight.question)
                  : 'Key strength'}
              </div>
              <p className="history-highlight-card__body">
                {primaryHighlight?.answer ||
                  'Highlights not available for this session yet.'}
              </p>
            </div>
            <div className="history-highlight-card history-highlight-card--growth">
              <div className="history-highlight-card__label">
                <TrendingUp className="h-4 w-4" aria-hidden />
                {secondaryHighlight
                  ? truncateHighlightTitle(secondaryHighlight.question, 28)
                  : 'Growth area'}
              </div>
              <p className="history-highlight-card__body">
                {secondaryHighlight
                  ? secondaryHighlight.answer || secondaryHighlight.question
                  : 'Complete more sessions to unlock comparative growth signals.'}
              </p>
            </div>
          </div>
        </section>

        <section className="history-detail-panel__section">
          <h4 className="history-detail-panel__section-title">
            <Brain className="h-4 w-4" aria-hidden />
            AI Synthesis
          </h4>
          <div className="history-synthesis">
            {feedbackText || 'AI feedback is not available for this session yet.'}
          </div>
        </section>

        <section className="history-detail-panel__section" id="history-transcript-section">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="history-detail-panel__section-title mb-0">
              <MessageSquare className="h-4 w-4" aria-hidden />
              Transcript Snippet
            </h4>
            {transcript.length > 0 ? (
              <button
                type="button"
                onClick={onOpenFullTranscript}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                View full
              </button>
            ) : null}
          </div>
          {transcript.length > 0 ? (
            <div className="history-transcript-snippet">
              {snippet.aiLine ? (
                <div className="history-transcript-snippet__row">
                  <span className="history-transcript-snippet__speaker history-transcript-snippet__speaker--ai">
                    AI:
                  </span>
                  <span className="text-[var(--color-on-surface-variant)]">{snippet.aiLine.text}</span>
                </div>
              ) : null}
              {snippet.candidateLine ? (
                <div className="history-transcript-snippet__row">
                  <span className="history-transcript-snippet__speaker history-transcript-snippet__speaker--you">
                    YOU:
                  </span>
                  <span className="text-[var(--color-on-surface)]">{snippet.candidateLine.text}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Transcript not available for this session.
            </p>
          )}
        </section>
      </div>

      <div className="history-detail-panel__footer">
        <button
          type="button"
          onClick={onPracticeAgain}
          disabled={!canPracticeAgain || isPracticing}
          className="history-detail-panel__cta"
        >
          <RotateCcw className={`h-4 w-4 ${isPracticing ? 'animate-spin' : ''}`} aria-hidden />
          {isPracticing ? 'Starting session...' : 'Practice this again'}
        </button>
        <div className="history-detail-panel__secondary-row">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="history-detail-panel__secondary-btn opacity-60"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden />
            Download report
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="history-detail-panel__secondary-btn history-detail-panel__secondary-btn--danger"
            aria-label="Delete session"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

const SessionHistoryDetailPanel = React.memo(SessionHistoryDetailPanelComponent);
export default SessionHistoryDetailPanel;
