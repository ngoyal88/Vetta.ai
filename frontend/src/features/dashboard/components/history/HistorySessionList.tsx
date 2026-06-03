import React, { memo } from 'react';

import type { InterviewHistoryItem } from 'shared/services/api';
import { getInterviewId } from '../../utils/interviewHistoryUtils';
import SessionHistoryCard from './SessionHistoryCard';

type HistorySessionListProps = {
  items: InterviewHistoryItem[];
  selectedId: string | null;
  onSelectSession: (id: string) => void;
  onOpenTranscript: (id: string) => void;
};

function HistorySessionListComponent({
  items,
  selectedId,
  onSelectSession,
  onOpenTranscript,
}: HistorySessionListProps) {
  return (
    <div className="history-grid__list history-list">
      {items.map((interview) => {
        const sessionId = getInterviewId(interview);
        return (
          <SessionHistoryCard
            key={sessionId}
            sessionId={sessionId}
            interview={interview}
            isSelected={selectedId === sessionId}
            onSelectSession={onSelectSession}
            onOpenTranscript={onOpenTranscript}
          />
        );
      })}
    </div>
  );
}

export const HistorySessionList = memo(HistorySessionListComponent);
