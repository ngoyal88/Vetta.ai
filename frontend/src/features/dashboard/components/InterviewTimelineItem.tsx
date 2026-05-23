import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';

import type { InterviewHistoryItem } from 'shared/services/api';
import { formatDate } from 'core/utils';
import RecommendationBadge from './RecommendationBadge';
import ScoreDonut from './ScoreDonut';
import TranscriptReplay from './TranscriptReplay';
import {
  formatInterviewTitle,
  getInterviewStartedAt,
  parseFeedback,
} from '../utils/interviewHistoryUtils';

type InterviewTimelineItemProps = {
  interview: InterviewHistoryItem;
  isExpanded: boolean;
  isDeleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
};

const InterviewTimelineItem: React.FC<InterviewTimelineItemProps> = ({
  interview,
  isExpanded,
  isDeleting,
  onToggle,
  onDelete,
}) => {
  const startedAt = getInterviewStartedAt(interview);
  const overall = interview.scores?.overall as number | undefined;
  const title = formatInterviewTitle(interview);
  const { text: feedbackText, generatedAt: feedbackGeneratedAt } = parseFeedback(interview);
  const transcript = interview.live_transcription || [];

  return (
    <li className="relative flex gap-4 pl-12 pb-6">
      <div className="absolute left-0 top-1.5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-raised">
        <ScoreDonut score={overall} size={28} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-zinc-400">{formatDate(startedAt)}</span>
              {interview.difficulty ? (
                <span className="text-xs text-zinc-600">· {String(interview.difficulty)}</span>
              ) : null}
              <RecommendationBadge score={overall} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
            >
              {isExpanded ? 'Hide' : 'Details'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
                <div className="grid gap-2 text-sm text-[var(--cream-3)] sm:grid-cols-2">
                  {interview.candidate_name ? (
                    <p>
                      <span className="text-[var(--cream-4)]">Candidate:</span>{' '}
                      {String(interview.candidate_name)}
                    </p>
                  ) : null}
                  {interview.target_company ? (
                    <p>
                      <span className="text-[var(--cream-4)]">Company:</span>{' '}
                      {String(interview.target_company)}
                    </p>
                  ) : null}
                  {interview.interview_focus ? (
                    <p>
                      <span className="text-[var(--cream-4)]">Focus:</span>{' '}
                      {String(interview.interview_focus).replace(/_/g, ' ')}
                    </p>
                  ) : null}
                  {typeof interview.duration_minutes === 'number' ? (
                    <p>
                      <span className="text-[var(--cream-4)]">Duration:</span>{' '}
                      {interview.duration_minutes} min
                    </p>
                  ) : null}
                  {typeof interview.questions_answered === 'number' ? (
                    <p>
                      <span className="text-[var(--cream-4)]">Questions:</span>{' '}
                      {interview.questions_answered}
                    </p>
                  ) : null}
                  {interview.status ? (
                    <p>
                      <span className="text-[var(--cream-4)]">Status:</span> {String(interview.status)}
                    </p>
                  ) : null}
                </div>

                {feedbackText ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-overlay p-4">
                    <p className="mb-2 text-xs text-zinc-500">
                      {feedbackGeneratedAt ? `Generated ${formatDate(feedbackGeneratedAt)}` : 'Feedback'}
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{feedbackText}</p>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">
                    Transcript
                  </p>
                  <TranscriptReplay lines={transcript} />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </li>
  );
};

export default InterviewTimelineItem;
