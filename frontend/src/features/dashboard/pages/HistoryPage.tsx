import React from 'react';
import { motion } from 'framer-motion';
import { Clock, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import InterviewTimelineItem from '../components/InterviewTimelineItem';
import { useInterviewHistory } from '../hooks/useInterviewHistory';
import { getInterviewId } from '../utils/interviewHistoryUtils';
import { api } from 'shared/services/api';
import { useAuth } from 'shared/context/AuthContext';
import { getSkipPrecheck } from 'features/interview/utils/precheckStorage';
import { PreSessionCheckerWithBrowserCheck } from 'features/interview/components/PreSessionChecker';

const HistoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const {
    items,
    loading,
    refresh,
    deleteInterview,
    expandedId,
    toggleExpanded,
    deletingId,
  } = useInterviewHistory({ limit: 20 });
  const [startingPracticeId, setStartingPracticeId] = React.useState<string | null>(null);
  const [showPreCheck, setShowPreCheck] = React.useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = React.useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-base px-5 py-6 pt-16">
      {showPreCheck && preCheckSessionId && (
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
      )}
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
          History
        </p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--border-subtle)] bg-raised p-6 md:p-8"
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[var(--teal-1)]" />
              <h1 className="text-xl font-semibold text-[var(--cream-0)]">Session history</h1>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--teal-1)] border-t-transparent" />
              <p className="text-sm text-zinc-500">Loading sessions...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="mb-4 text-zinc-500">No previous interviews yet</p>
              <Link
                to="/modes"
                className="btn-outline-cyan inline-flex h-10 items-center px-4 text-sm"
              >
                Start your first interview
              </Link>
            </div>
          ) : (
            <div className="relative">
              <div
                className="absolute bottom-2 left-[19px] top-2 w-px bg-[var(--border-subtle)]"
                aria-hidden
              />
              <ul className="space-y-0">
                {items.map((interview) => {
                  const id = getInterviewId(interview);
                  return (
                    <InterviewTimelineItem
                      key={id}
                      interview={interview}
                      isExpanded={expandedId === id}
                      isDeleting={deletingId === id}
                      isPracticing={startingPracticeId === id}
                      onToggle={() => toggleExpanded(id)}
                      onDelete={() => deleteInterview(id)}
                      onPracticeAgain={() => handlePracticeAgain(id)}
                    />
                  );
                })}
              </ul>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default HistoryPage;
