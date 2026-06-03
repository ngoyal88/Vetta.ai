import React, { memo, useCallback } from 'react';
import { Crosshair, FileText } from 'lucide-react';

import type { InterviewHistoryItem } from 'shared/services/api';
import ScoreSignalRing from './ScoreSignalRing';
import { getInterviewStartedAt } from '../../utils/interviewHistoryUtils';
import {
  formatHistoryDateShort,
  formatHistoryTimeRange,
  getScoreVerdict,
  getSessionCardSubtitle,
  getSessionCardTitle,
  isRoleTargetedSession,
} from '../../utils/historyPresentationUtils';

type SessionHistoryCardProps = {
  sessionId: string;
  interview: InterviewHistoryItem;
  isSelected: boolean;
  onSelectSession: (id: string) => void;
  onOpenTranscript: (id: string) => void;
};

function SessionHistoryCardComponent({
  sessionId,
  interview,
  isSelected,
  onSelectSession,
  onOpenTranscript,
}: SessionHistoryCardProps) {
  const startedAt = getInterviewStartedAt(interview);
  const overall = interview.scores?.overall as number | undefined;
  const verdict = getScoreVerdict(overall);
  const title = getSessionCardTitle(interview);
  const subtitle = getSessionCardSubtitle(interview);
  const targeted = isRoleTargetedSession(interview);
  const Icon = targeted ? Crosshair : FileText;

  const handleSelect = useCallback(() => {
    onSelectSession(sessionId);
  }, [onSelectSession, sessionId]);

  const handleTranscript = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenTranscript(sessionId);
    },
    [onOpenTranscript, sessionId],
  );

  const handleReport = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectSession(sessionId);
    },
    [onSelectSession, sessionId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectSession(sessionId);
      }
    },
    [onSelectSession, sessionId],
  );

  return (
    <article
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={[
        'history-session-card',
        isSelected ? 'history-session-card--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isSelected ? <div className="history-session-card__accent" aria-hidden /> : null}

      <div className="history-session-card__header">
        <div className="history-session-card__identity">
          <div
            className={[
              'history-session-card__icon',
              isSelected ? 'history-session-card__icon--selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="history-session-card__title">{title}</h3>
            <p className="history-session-card__subtitle">{subtitle}</p>
          </div>
        </div>
        <div className="history-session-card__meta">
          <div className="history-session-card__meta-date">{formatHistoryDateShort(startedAt)}</div>
          <div>{formatHistoryTimeRange(startedAt, interview.duration_minutes)}</div>
        </div>
      </div>

      <div className="history-session-card__divider" />

      <div className="history-session-card__footer">
        <div className="history-session-card__score">
          <ScoreSignalRing percent={verdict.percent} strokeClass={verdict.ringClass} />
          <div>
            <div className="history-session-card__score-value">
              {verdict.percent != null ? `${verdict.percent}% ${verdict.metricLabel}` : 'No score'}
            </div>
            <div className={`history-session-card__score-label ${verdict.labelClass}`}>
              {verdict.label}
            </div>
          </div>
        </div>
        <div className="history-session-card__actions">
          <button
            type="button"
            onClick={handleTranscript}
            className="history-session-card__btn history-session-card__btn--ghost"
          >
            Transcript
          </button>
          <button
            type="button"
            onClick={handleReport}
            className={[
              'history-session-card__btn',
              isSelected
                ? 'history-session-card__btn--primary'
                : 'history-session-card__btn--outline',
            ].join(' ')}
          >
            Report
          </button>
        </div>
      </div>
    </article>
  );
}

const SessionHistoryCard = memo(SessionHistoryCardComponent);
export default SessionHistoryCard;
