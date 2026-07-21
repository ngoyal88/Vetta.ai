import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useAuth } from 'shared/context/AuthContext';
import { api } from 'shared/services/api';
import { getSkipPrecheck } from 'features/interview/preflight/precheckStorage';
import { useActiveVaultResume } from 'features/modes/resume-deep-dive/hooks/useActiveVaultResume';
import { useJobDescriptionFileUpload } from 'shared/hooks/useJobDescriptionFileUpload';
import { applyJdTargetHints, extractJdTargetHints } from 'shared/utils/jdInputUtils';
import {
  ROLE_TARGETED_DIFFICULTY_STOPS,
  difficultyProgressPercent,
  findDifficultyStop,
} from 'features/modes/shared/constants/difficultyStops';
import { apiTypeFromCatalogSlug } from 'features/interview/domain/modeContract';
import { resumeDisplayName } from 'features/modes/shared/utils/resumeDisplayName';

export function useRoleTargetedSetup() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jdFitSnapshotId = searchParams.get('jd_fit_snapshot_id')?.trim() || null;

  const { profile: parsedResume, loading: loadingResume } = useActiveVaultResume();

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [focusSelections, setFocusSelections] = useState<string[]>(['technical', 'system_design']);
  const [difficultyValue, setDifficultyValue] = useState(3);
  const [yoeValue, setYoeValue] = useState(6);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const presetRole = searchParams.get('target_role');
    if (presetRole && !role) {
      setRole(presetRole);
    }
  }, [searchParams, role]);

  const companyValue = useMemo(() => company.trim(), [company]);
  const roleValue = useMemo(() => role.trim(), [role]);
  const jdCharCount = jobDescription.length;

  const focusValue = useMemo(() => {
    if (focusSelections.length === 1 && focusSelections[0] !== 'domain') {
      return focusSelections[0];
    }
    return 'mixed';
  }, [focusSelections]);

  const activeDifficultyStop = useMemo(
    () => findDifficultyStop(ROLE_TARGETED_DIFFICULTY_STOPS, difficultyValue),
    [difficultyValue],
  );

  const difficulty = activeDifficultyStop.api;
  const difficultyLabel = activeDifficultyStop.badge;

  const yoeLabel = useMemo(() => {
    if (yoeValue <= 1) return '0 - 1 Years';
    const low = Math.max(0, yoeValue - 1);
    const high = yoeValue + 1;
    return `${low} - ${high} Years`;
  }, [yoeValue]);

  const difficultyProgress = useMemo(
    () => difficultyProgressPercent(difficultyValue, ROLE_TARGETED_DIFFICULTY_STOPS.length),
    [difficultyValue],
  );

  const yoeProgress = useMemo(() => `${(yoeValue / 15) * 100}%`, [yoeValue]);

  const onJdTextLoaded = useCallback(
    (text: string) => {
      setJobDescription(text);
      applyJdTargetHints(
        extractJdTargetHints(text),
        { role, company },
        { setRole, setCompany },
      );
    },
    [role, company],
  );

  const {
    fileInputRef,
    jdUploading,
    handleUploadClick,
    handleFileChange: handleUploadFile,
  } = useJobDescriptionFileUpload({ onTextLoaded: onJdTextLoaded });

  const canLaunch = Boolean(roleValue) && focusSelections.length > 0 && !starting && !jdUploading;
  const activeResumeName = useMemo(() => resumeDisplayName(parsedResume), [parsedResume]);

  const toggleFocus = useCallback((value: string) => {
    setFocusSelections((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  }, []);

  const clearJobDescription = () => {
    setJobDescription('');
  };

  const handleStartInterview = useCallback(async () => {
    if (!currentUser) {
      toast.error('Please sign in again');
      return;
    }
    if (!roleValue) {
      toast.error('Select or enter a target role');
      return;
    }
    if (focusSelections.length === 0) {
      toast.error('Select at least one interview focus');
      return;
    }

    const jdText = jobDescription.trim();
    if (!parsedResume && !jdText) {
      toast('No resume or job description — the session will use your role and company only.');
    } else if (!parsedResume) {
      toast('No active resume — we will lean on your role, company, and any job description.');
    }

    setStarting(true);
    try {
      const candidateName =
        resumeDisplayName(parsedResume) ||
        currentUser.displayName ||
        currentUser.email?.split('@')[0] ||
        'Candidate';

      const response = await api.startInterview({
        interviewType: apiTypeFromCatalogSlug('role_targeted'),
        difficulty,
        resumeData: parsedResume,
        candidateName,
        yearsExperience: yoeValue > 0 ? yoeValue : null,
        config: {
          target_role: roleValue,
          target_company: companyValue || null,
          job_description: jdText || null,
          interview_focus: focusValue,
          jd_fit_snapshot_id: jdFitSnapshotId,
        },
      });

      const sessionId = response.session_id;
      sessionStorage.setItem(`interview_type_${sessionId}`, apiTypeFromCatalogSlug('role_targeted'));
      try {
        window.localStorage.removeItem('interviewConfig');
      } catch {
        /* ignore */
      }

      if (getSkipPrecheck()) {
        navigate(`/interview/${sessionId}`);
        return;
      }

      setPreCheckSessionId(sessionId);
      setShowPreCheck(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to start interview: ${message}`);
    } finally {
      setStarting(false);
    }
  }, [
    companyValue,
    currentUser,
    difficulty,
    focusSelections.length,
    focusValue,
    jobDescription,
    jdFitSnapshotId,
    navigate,
    parsedResume,
    roleValue,
    yoeValue,
  ]);

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

  return {
    currentUser,
    fileInputRef,
    parsedResume,
    loadingResume,
    activeResumeName,
    company,
    setCompany,
    role,
    setRole,
    jobDescription,
    setJobDescription,
    focusSelections,
    difficultyValue,
    setDifficultyValue,
    yoeValue,
    setYoeValue,
    difficultyLabel,
    yoeLabel,
    difficultyProgress,
    yoeProgress,
    jdCharCount,
    roleValue,
    companyValue,
    canLaunch,
    starting,
    jdUploading,
    showPreCheck,
    preCheckSessionId,
    toggleFocus,
    handleUploadClick,
    clearJobDescription,
    handleUploadFile,
    handleStartInterview,
    dismissPreCheck,
    completePreCheck,
  };
}
