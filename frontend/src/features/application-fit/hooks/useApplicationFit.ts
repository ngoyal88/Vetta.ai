import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useActiveVaultResume } from 'features/modes/resume-deep-dive/hooks/useActiveVaultResume';

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

  useEffect(() => {
    const state = (location.state as LocationState | null) ?? {};
    if (state.role) setTargetRole(state.role);
    if (state.jobDescription) setJobDescription(state.jobDescription.slice(0, JD_MAX_CHARS));
    if (state.targetCompany) setTargetCompany(state.targetCompany);
  }, [location.state]);

  useEffect(() => {
    const snapshotId = searchParams.get('snapshot_id');
    if (!snapshotId) return;
    let cancelled = false;
    void (async () => {
      try {
        setView('loading');
        const data = await applicationFitApi.getSnapshot(snapshotId);
        if (!cancelled) {
          setReport(data);
          setView('report');
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load snapshot');
          setView('input');
          setSearchParams({}, { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  const canAnalyze = useMemo(
    () =>
      canAnalyzeApplicationFit(targetRole, jobDescription) &&
      !resumeLoading &&
      Boolean(entry && version),
    [targetRole, jobDescription, resumeLoading, entry, version],
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
  };
}
