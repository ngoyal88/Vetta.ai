import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, BarChart3, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { fadeUpWithDelay, getHeaderMotion } from 'features/modes/shared/utils/motion';
import SessionHistoryDetailPanel from '../components/history/SessionHistoryDetailPanel';
import { HistorySessionList } from '../components/history/HistorySessionList';
import { HistoryToolbar } from '../components/history/HistoryToolbar';
import { TranscriptOverlay } from '../components/history/TranscriptOverlay';
import { useHistoryPageState } from '../hooks/useHistoryPageState';
import PageLoadingState from 'shared/components/PageLoadingState';
import { PreSessionCheckerWithBrowserCheck } from 'features/interview/components/PreSessionChecker';
import {
  AI_INTERVIEW_ANALYTICS_PATH,
  AI_INTERVIEW_HUB_PATH,
} from 'core/constants/interviewModes';

const HistoryPage: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const state = useHistoryPageState();
  const headerMotion = getHeaderMotion(reduceMotion);

  return (
    <div className="history-page relative min-h-[calc(100vh-4rem)] overflow-x-hidden pb-16 pt-10">
      {state.showPreCheck && state.preCheckSessionId ? (
        <PreSessionCheckerWithBrowserCheck
          sessionId={state.preCheckSessionId}
          getAuthToken={() => state.currentUser?.getIdToken?.()}
          onAllPassed={state.completePreCheck}
          onCancel={state.dismissPreCheck}
        />
      ) : null}

      <div className="history-page__glow" aria-hidden />

      <div className="app-container relative z-10">
        <Link
          to={AI_INTERVIEW_HUB_PATH}
          className="mb-6 inline-flex w-fit items-center gap-2 text-sm font-medium text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to training modes
        </Link>

        <motion.header
          {...headerMotion}
          className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <h1 className="type-headline-lg text-[var(--color-on-surface)]">Session History</h1>
            <p className="type-body-md mt-1 text-[var(--color-on-surface-variant)]">
              Review your past performance and intelligence reports.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to={AI_INTERVIEW_ANALYTICS_PATH}
              className="glass-panel inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] px-5 py-3 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-container)]"
            >
              <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
              Your progress
            </Link>
            <HistoryToolbar
              filterTab={state.filterTab}
              dateRange={state.dateRange}
              loading={state.loading}
              onFilterTabChange={state.setFilterTab}
              onDateRangeChange={state.setDateRange}
              onRefresh={state.refresh}
            />
          </div>
        </motion.header>

        {state.loading ? (
          <PageLoadingState variant="split" minHeightClassName="py-6" />
        ) : state.items.length === 0 ? (
          <div className="glass-panel rounded-xl py-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-secondary)]/25 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">
              <Clock className="h-6 w-6" aria-hidden />
            </div>
            <p className="type-body-lg text-[var(--color-on-surface-variant)]">No previous interviews yet</p>
            <Link
              to={AI_INTERVIEW_HUB_PATH}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-container)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary-container)] shadow-[var(--shadow-luminous)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)]"
            >
              Start your first interview
            </Link>
          </div>
        ) : state.filteredItems.length === 0 ? (
          <div className="glass-panel rounded-xl py-16 text-center">
            <p className="type-body-md text-[var(--color-on-surface-variant)]">
              No sessions match these filters.
            </p>
            <button
              type="button"
              onClick={state.clearFilters}
              className="mt-4 text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeUpWithDelay(0.06)}
            className="history-grid"
          >
            <HistorySessionList
              items={state.filteredItems}
              selectedId={state.selectedId}
              onSelectSession={state.selectSession}
              onOpenTranscript={state.openTranscriptOverlay}
            />

            <div ref={state.detailRef} className="history-grid__detail history-detail-anchor">
              <SessionHistoryDetailPanel
                interview={state.selectedInterview}
                onOpenFullTranscript={() =>
                  state.selectedId && state.openTranscriptOverlay(state.selectedId)
                }
                onPracticeAgain={() =>
                  state.selectedId && void state.handlePracticeAgain(state.selectedId)
                }
                onDelete={() => state.selectedId && void state.deleteInterview(state.selectedId)}
                isPracticing={state.isPracticing}
                isDeleting={state.isDeleting}
                canPracticeAgain={state.canPracticeAgain}
              />
            </div>
          </motion.div>
        )}
      </div>

      {state.showTranscriptOverlay && state.selectedInterview ? (
        <TranscriptOverlay
          interview={state.selectedInterview}
          srcDoc={state.selectedTranscriptDocument}
          onClose={state.closeTranscriptOverlay}
        />
      ) : null}
    </div>
  );
};

export default HistoryPage;
