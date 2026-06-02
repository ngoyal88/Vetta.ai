import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, RefreshCw, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import SessionHistoryCard from '../components/history/SessionHistoryCard';
import SessionHistoryDetailPanel from '../components/history/SessionHistoryDetailPanel';
import { useInterviewHistory } from '../hooks/useInterviewHistory';
import { getInterviewId } from '../utils/interviewHistoryUtils';
import {
  filterHistoryItems,
  type HistoryDateRange,
  type HistoryFilterTab,
} from '../utils/historyPresentationUtils';
import { api } from 'shared/services/api';
import { useAuth } from 'shared/context/AuthContext';
import { getSkipPrecheck } from 'features/interview/utils/precheckStorage';
import { PreSessionCheckerWithBrowserCheck } from 'features/interview/components/PreSessionChecker';
import { AI_INTERVIEW_HUB_PATH } from 'core/constants/interviewModes';
import {
  buildTranscriptDocument,
  formatDurationLabel,
  formatTranscriptDate,
} from '../components/history/transcriptOverlay/transcriptOverlayTemplate';

const fadeUpTransition = {
  duration: 0.45,
  ease: 'easeOut' as const,
};

const FILTER_TABS: { id: HistoryFilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'role_targeted', label: 'Role Targeted' },
  { id: 'resume', label: 'Resume Deep Dive' },
];

const DATE_RANGE_OPTIONS: { id: HistoryDateRange; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7 days' },
  { id: '14d', label: 'Last 14 days' },
  { id: '30d', label: 'Last 30 days' },
];

const HistoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const detailRef = React.useRef<HTMLDivElement>(null);
  const { items, loading, refresh, deleteInterview, deletingId } = useInterviewHistory({ limit: 20 });

  const [filterTab, setFilterTab] = React.useState<HistoryFilterTab>('all');
  const [dateRange, setDateRange] = React.useState<HistoryDateRange>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showTranscriptOverlay, setShowTranscriptOverlay] = React.useState(false);
  const [startingPracticeId, setStartingPracticeId] = React.useState<string | null>(null);
  const [showPreCheck, setShowPreCheck] = React.useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = React.useState<string | null>(null);

  const filteredItems = React.useMemo(
    () => filterHistoryItems(items, filterTab, dateRange),
    [items, filterTab, dateRange],
  );

  React.useEffect(() => {
    if (!filteredItems.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && filteredItems.some((item) => getInterviewId(item) === current)) {
        return current;
      }
      return getInterviewId(filteredItems[0]);
    });
  }, [filteredItems]);

  React.useEffect(() => {
    setShowTranscriptOverlay(false);
  }, [selectedId]);

  const selectedInterview =
    filteredItems.find((item) => getInterviewId(item) === selectedId) ?? null;

  const headerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: fadeUpTransition,
      };

  const selectSession = React.useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const handlePracticeAgain = React.useCallback(
    async (sessionId: string) => {
      const source = items.find((item) => getInterviewId(item) === sessionId);
      if (!source) return;
      if (source.interview_type !== 'role_targeted' && source.interview_type !== 'resume') return;
      if (!currentUser) {
        toast.error('Please sign in again');
        return;
      }

      const isRoleTargeted = source.interview_type === 'role_targeted';
      try {
        setStartingPracticeId(sessionId);
        const response = await api.startInterview(
          currentUser.uid,
          isRoleTargeted ? 'role_targeted' : 'resume',
          String(source.difficulty || 'medium'),
          undefined,
          isRoleTargeted ? String(source.target_role || source.custom_role || '') : null,
          String(source.candidate_name || currentUser.displayName || 'Candidate'),
          typeof source.years_experience === 'number' ? source.years_experience : null,
          isRoleTargeted
            ? {
                targetCompany: source.target_company ? String(source.target_company) : null,
                targetRole: String(source.target_role || source.custom_role || ''),
                interviewFocus: source.interview_focus ? String(source.interview_focus) : 'mixed',
              }
            : {},
        );

        const newSessionId = response.session_id;
        sessionStorage.setItem(`interview_type_${newSessionId}`, isRoleTargeted ? 'role_targeted' : 'resume');

        if (getSkipPrecheck()) {
          navigate(`/interview/${newSessionId}`);
          return;
        }
        setPreCheckSessionId(newSessionId);
        setShowPreCheck(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to start session: ${message}`);
      } finally {
        setStartingPracticeId(null);
      }
    },
    [currentUser, items, navigate],
  );

  const openTranscriptOverlay = React.useCallback(
    (id: string) => {
      selectSession(id);
      setShowTranscriptOverlay(true);
      requestAnimationFrame(() => {
        document.getElementById('history-transcript-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    [selectSession],
  );

  const selectedTranscriptDocument = React.useMemo(() => {
    if (!selectedInterview?.live_transcription?.length) return '';
    const role = selectedInterview.target_role || selectedInterview.custom_role || 'Interview Session';
    const company = selectedInterview.target_company ? ` @ ${selectedInterview.target_company}` : '';
    return buildTranscriptDocument(selectedInterview.live_transcription, {
      roleLabel: `${role}${company}`,
      startedAtLabel: formatTranscriptDate(selectedInterview.started_at || selectedInterview.created_at),
      durationLabel: formatDurationLabel(selectedInterview.duration_minutes),
    });
  }, [selectedInterview]);

  return (
    <div className="history-page relative min-h-[calc(100vh-4rem)] overflow-x-hidden pb-16 pt-10">
      {showPreCheck && preCheckSessionId ? (
        <PreSessionCheckerWithBrowserCheck
          sessionId={preCheckSessionId}
          getAuthToken={() => currentUser?.getIdToken?.()}
          onAllPassed={() => {
            const id = preCheckSessionId;
            setShowPreCheck(false);
            setPreCheckSessionId(null);
            navigate(`/interview/${id}`);
          }}
          onCancel={() => {
            setShowPreCheck(false);
            setPreCheckSessionId(null);
          }}
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

          <div className="history-toolbar">
            <label className="history-toolbar__control">
              <span className="text-[var(--color-on-surface-variant)]">Mode</span>
              <select
                value={filterTab}
                onChange={(event) => setFilterTab(event.target.value as HistoryFilterTab)}
                className="min-w-[10.5rem] bg-transparent text-sm text-[var(--color-on-surface)] outline-none"
                aria-label="Filter by interview mode"
              >
                {FILTER_TABS.map((tab) => (
                  <option key={tab.id} value={tab.id} className="bg-[var(--color-surface)] text-[var(--color-on-surface)]">
                    {tab.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="history-toolbar__control">
              <Calendar className="h-4 w-4 text-[var(--color-on-surface-variant)]" aria-hidden />
              <select
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value as HistoryDateRange)}
                className="min-w-[9.5rem] bg-transparent text-sm text-[var(--color-on-surface)] outline-none"
                aria-label="Filter by date range"
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} className="bg-[var(--color-surface)] text-[var(--color-on-surface)]">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="history-toolbar__control"
              aria-label="Refresh sessions"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </motion.header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            <p className="type-body-md text-[var(--color-on-surface-variant)]">Loading sessions...</p>
          </div>
        ) : items.length === 0 ? (
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
        ) : filteredItems.length === 0 ? (
          <div className="glass-panel rounded-xl py-16 text-center">
            <p className="type-body-md text-[var(--color-on-surface-variant)]">
              No sessions match these filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterTab('all');
                setDateRange('all');
              }}
              className="mt-4 text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...fadeUpTransition, delay: 0.06 }}
            className="history-grid"
          >
            <div className="history-grid__list history-list">
              {filteredItems.map((interview) => {
                const id = getInterviewId(interview);
                return (
                  <SessionHistoryCard
                    key={id}
                    interview={interview}
                    isSelected={selectedId === id}
                    onSelect={() => selectSession(id)}
                    onTranscript={() => openTranscriptOverlay(id)}
                    onReport={() => selectSession(id)}
                  />
                );
              })}
            </div>

            <div ref={detailRef} className="history-grid__detail history-detail-anchor">
              <SessionHistoryDetailPanel
                interview={selectedInterview}
                onOpenFullTranscript={() => selectedId && openTranscriptOverlay(selectedId)}
                onPracticeAgain={() => selectedId && handlePracticeAgain(selectedId)}
                onDelete={() => selectedId && deleteInterview(selectedId)}
                isPracticing={Boolean(selectedId && startingPracticeId === selectedId)}
                isDeleting={Boolean(selectedId && deletingId === selectedId)}
                canPracticeAgain={
                  selectedInterview?.interview_type === 'role_targeted' ||
                  selectedInterview?.interview_type === 'resume'
                }
              />
            </div>
          </motion.div>
        )}
      </div>

      {showTranscriptOverlay && selectedInterview ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-end bg-[var(--color-surface)]/80 p-0 backdrop-blur-sm md:justify-center md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Full session transcript"
        >
          <div className="flex h-full w-full flex-col overflow-hidden rounded-none border border-white/15 bg-[var(--color-surface-container-lowest)] shadow-[0_0_40px_rgba(59,130,246,0.2)] md:h-[921px] md:max-h-[90vh] md:w-[800px] md:rounded-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-on-surface-variant)]">
                  Transcript viewer
                </p>
                <h2 className="truncate text-sm font-semibold text-[var(--color-on-surface)] sm:text-base">
                  {selectedInterview.target_role || selectedInterview.custom_role || 'Session Transcript'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTranscriptOverlay(false)}
                className="rounded-md p-2 text-[var(--color-on-surface-variant)] transition-colors hover:bg-white/10 hover:text-[var(--color-on-surface)]"
                aria-label="Close transcript viewer"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <iframe
              title="Session transcript"
              srcDoc={selectedTranscriptDocument}
              className="h-full w-full border-0"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HistoryPage;
