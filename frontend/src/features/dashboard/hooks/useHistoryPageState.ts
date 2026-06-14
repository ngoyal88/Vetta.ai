import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from 'shared/services/api';
import { useAuth } from 'shared/context/AuthContext';
import { getSkipPrecheck } from 'features/interview/utils/precheckStorage';
import { getInterviewId } from '../utils/interviewHistoryUtils';
import {
  filterHistoryItems,
  type HistoryDateRange,
  type HistoryFilterTab,
} from '../utils/historyPresentationUtils';
import {
  buildTranscriptDocument,
  formatDurationLabel,
  formatTranscriptDate,
} from '../components/history/transcriptOverlay/transcriptOverlayTemplate';
import { useInterviewHistory } from './useInterviewHistory';

export function useHistoryPageState() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const detailRef = useRef<HTMLDivElement>(null);

  const { items, loading, refresh, deleteInterview, deletingId } = useInterviewHistory({ limit: 20 });

  const [filterTab, setFilterTab] = useState<HistoryFilterTab>('all');
  const [dateRange, setDateRange] = useState<HistoryDateRange>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTranscriptOverlay, setShowTranscriptOverlay] = useState(false);
  const [startingPracticeId, setStartingPracticeId] = useState<string | null>(null);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState<string | null>(null);

  const filteredItems = useMemo(
    () => filterHistoryItems(items, filterTab, dateRange),
    [items, filterTab, dateRange],
  );

  useEffect(() => {
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

  useEffect(() => {
    setShowTranscriptOverlay(false);
  }, [selectedId]);

  const selectedInterview = useMemo(
    () => filteredItems.find((item) => getInterviewId(item) === selectedId) ?? null,
    [filteredItems, selectedId],
  );

  const selectedTranscriptDocument = useMemo(() => {
    if (!selectedInterview?.live_transcription?.length) return '';
    const role = selectedInterview.target_role || selectedInterview.custom_role || 'Interview Session';
    const company = selectedInterview.target_company ? ` @ ${selectedInterview.target_company}` : '';
    return buildTranscriptDocument(selectedInterview.live_transcription, {
      roleLabel: `${role}${company}`,
      startedAtLabel: formatTranscriptDate(selectedInterview.started_at || selectedInterview.created_at),
      durationLabel: formatDurationLabel(selectedInterview.duration_minutes),
    });
  }, [selectedInterview]);

  const selectSession = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const openTranscriptOverlay = useCallback(
    (id: string) => {
      selectSession(id);
      setShowTranscriptOverlay(true);
    },
    [selectSession],
  );

  const closeTranscriptOverlay = () => {
    setShowTranscriptOverlay(false);
  };

  const clearFilters = () => {
    setFilterTab('all');
    setDateRange('all');
  };

  const handlePracticeAgain = useCallback(
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

  const dismissPreCheck = () => {
    setShowPreCheck(false);
    setPreCheckSessionId(null);
  };

  const completePreCheck = () => {
    const id = preCheckSessionId;
    setShowPreCheck(false);
    setPreCheckSessionId(null);
    if (id) navigate(`/interview/${id}`);
  };

  const canPracticeAgain =
    selectedInterview?.interview_type === 'role_targeted' ||
    selectedInterview?.interview_type === 'resume';

  const isPracticing = Boolean(selectedId && startingPracticeId === selectedId);
  const isDeleting = Boolean(selectedId && deletingId === selectedId);

  return {
    currentUser,
    detailRef,
    items,
    loading,
    refresh,
    filterTab,
    setFilterTab,
    dateRange,
    setDateRange,
    filteredItems,
    selectedId,
    selectedInterview,
    showTranscriptOverlay,
    selectedTranscriptDocument,
    showPreCheck,
    preCheckSessionId,
    selectSession,
    openTranscriptOverlay,
    closeTranscriptOverlay,
    clearFilters,
    handlePracticeAgain,
    dismissPreCheck,
    completePreCheck,
    deleteInterview,
    canPracticeAgain,
    isPracticing,
    isDeleting,
  };
}
