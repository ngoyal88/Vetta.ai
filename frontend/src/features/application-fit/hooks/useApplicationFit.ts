import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useActiveVaultResume } from 'features/modes/resume-deep-dive/hooks/useActiveVaultResume';
import { useJobDescriptionFileUpload } from 'shared/hooks/useJobDescriptionFileUpload';
import {
  applyJdTargetHints,
  extractJdTargetHints,
} from 'shared/utils/jdInputUtils';

import { useApplicationFitSnapshotQuery } from '../queries/useApplicationFitQueries';
import { applicationFitApi } from '../services/applicationFitApi';
import type { ApplicationFitView, ComputeResponse } from '../types/applicationFitTypes';
import { canAnalyzeApplicationFit, JD_MAX_CHARS } from '../types/applicationFitTypes';

type LocationState = {
  role?: string;
  jobDescription?: string;
  targetCompany?: string;
};

export function useApplicationFit() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { entry, version, loading: resumeLoading } = useActiveVaultResume();

  const [view, setView] = useState<ApplicationFitView>('input');
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [report, setReport] = useState<ComputeResponse | null>(null);

  const onJdTextLoaded = useCallback(
    (text: string) => {
      setJobDescription(text);
      applyJdTargetHints(
        extractJdTargetHints(text),
        { role: targetRole, company: targetCompany },
        { setRole: setTargetRole, setCompany: setTargetCompany },
      );
    },
    [targetRole, targetCompany],
  );

  const {
    fileInputRef,
    jdUploading,
    handleUploadClick: handleJdUploadClick,
    handleFileChange: handleJdFileChange,
  } = useJobDescriptionFileUpload({
    maxChars: JD_MAX_CHARS,
    onTextLoaded: onJdTextLoaded,
  });

  useEffect(() => {
    const state = (location.state as LocationState | null) ?? {};
    if (state.role) setTargetRole(state.role);
    if (state.jobDescription) setJobDescription(state.jobDescription.slice(0, JD_MAX_CHARS));
    if (state.targetCompany) setTargetCompany(state.targetCompany);
  }, [location.state]);

  const snapshotId = searchParams.get('snapshot_id');
  const { snapshot, loading: snapshotLoading, error: snapshotError } = useApplicationFitSnapshotQuery(snapshotId);

  useEffect(() => {
    if (!snapshotId) return;
    if (snapshotLoading) {
      setView('loading');
      return;
    }
    if (snapshot) {
      setReport(snapshot);
      setView('report');
      return;
    }
    if (snapshotError) {
      toast.error(snapshotError instanceof Error ? snapshotError.message : 'Failed to load snapshot');
      setView('input');
      setSearchParams({}, { replace: true });
    }
  }, [snapshot, snapshotError, snapshotId, snapshotLoading, setSearchParams]);

  const canAnalyze = useMemo(
    () =>
      canAnalyzeApplicationFit(targetRole, jobDescription) &&
      !resumeLoading &&
      !jdUploading &&
      Boolean(entry && version),
    [targetRole, jobDescription, resumeLoading, jdUploading, entry, version],
  );

  const analyzeFit = useCallback(async () => {
    if (!canAnalyze) return;
    setView('loading');
    try {
      const result = await applicationFitApi.compute({
        target_role: targetRole.trim(),
        target_company: targetCompany.trim() || undefined,
        job_description: jobDescription.trim(),
        resume_id: entry?.id,
        version_id: version?.id,
      });
      setReport(result);
      setView('report');
      setSearchParams({ snapshot_id: result.snapshot_id }, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
      setView('input');
    }
  }, [canAnalyze, targetRole, targetCompany, jobDescription, entry?.id, version?.id, setSearchParams]);

  const analyzeAgain = useCallback(() => {
    setReport(null);
    setView('input');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return {
    view,
    targetRole,
    setTargetRole,
    targetCompany,
    setTargetCompany,
    jobDescription,
    setJobDescription,
    report,
    canAnalyze,
    resumeLoading,
    entry,
    version,
    analyzeFit,
    analyzeAgain,
    fileInputRef,
    jdUploading,
    handleJdUploadClick,
    handleJdFileChange,
  };
}
