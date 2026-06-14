import React, { useEffect, useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from 'shared/context/AuthContext';
import { api } from 'shared/services/api';
import { PreSessionCheckerWithBrowserCheck } from 'features/interview/components/PreSessionChecker';
import { getSkipPrecheck } from 'features/interview/utils/precheckStorage';
import { AnalysisParametersSection } from '../components/AnalysisParametersSection';
import { IntelligenceSettingsSection } from '../components/IntelligenceSettingsSection';
import { LaunchFooter } from '../components/LaunchFooter';
import { ResumePreviewOverlay } from '../components/ResumePreviewOverlay';
import { SectionHeading } from '../components/SectionHeading';
import { SelectedDocumentCard } from '../components/SelectedDocumentCard';
import { SetupProgressSteps } from 'features/modes/shared/components/SetupProgressSteps';
import {
  DEFAULT_OBJECTIVES,
  INDUSTRY_SUGGESTIONS,
  type ObjectiveId,
} from '../constants/resumeDeepDiveOptions';
import { useActiveVaultResume } from '../hooks/useActiveVaultResume';
import { resumeDisplayName } from 'features/modes/shared/utils/resumeDisplayName';
import {
  estimateDataIntegrity,
  formatVaultDate,
  getScanDepthStop,
} from '../utils/resumeDeepDiveUtils';
import { getCardMotion, getHeaderMotion } from 'features/modes/shared/utils/motion';

const ResumeDeepDivePage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const industryListId = useId();

  const { profile, entry, version, loading: loadingResume } = useActiveVaultResume();

  const [scanDepthValue, setScanDepthValue] = useState(3);
  const [objectives, setObjectives] = useState<ObjectiveId[]>(DEFAULT_OBJECTIVES);
  const [targetRole, setTargetRole] = useState('');
  const [targetIndustry, setTargetIndustry] = useState('');
  const [includeMarketTrends, setIncludeMarketTrends] = useState(true);
  const [benchmarkFaang, setBenchmarkFaang] = useState(false);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeScanStop = useMemo(() => getScanDepthStop(scanDepthValue), [scanDepthValue]);
  const difficulty = activeScanStop.api;

  const integrityScore = useMemo(
    () => estimateDataIntegrity(profile, entry?.scorecard),
    [entry?.scorecard, profile],
  );

  const uploadedLabel = useMemo(
    () =>
      formatVaultDate(version?.created_at) ||
      formatVaultDate(entry?.last_updated) ||
      formatVaultDate(entry?.created_at) ||
      '—',
    [entry, version],
  );

  const systemReady = Boolean(profile) && !loadingResume;
  const canLaunch = systemReady && !starting;

  useEffect(() => {
    const seniority = profile?.seniority_level;
    if (typeof seniority !== 'string' || !seniority.trim()) return;
    setTargetRole((prev) => (prev.trim() ? prev : seniority.trim()));
  }, [profile?.seniority_level]);

  const toggleObjective = (id: ObjectiveId) => {
    setObjectives((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleBenchmarkFaangChange = (checked: boolean) => {
    setBenchmarkFaang(checked);
    if (checked) setScanDepthValue(3);
  };

  const handleOpenPreview = () => {
    if (!version?.has_source_file) {
      toast.error('No PDF file stored for this version. Re-upload in Vault.');
      return;
    }
    setPreviewOpen(true);
  };

  const handleStart = async () => {
    if (!currentUser) {
      toast.error('Please sign in again.');
      return;
    }
    if (!profile) {
      toast.error('Upload and activate a resume in Vault first.');
      return;
    }

    setStarting(true);
    try {
      const roleValue = targetRole.trim() || null;
      const industryValue = targetIndustry.trim() || null;
      const yearsValue =
        typeof profile.years_experience === 'number' && Number.isFinite(profile.years_experience)
          ? profile.years_experience
          : null;

      const response = await api.startInterview(
        currentUser.uid,
        'resume',
        difficulty,
        profile,
        roleValue,
        resumeDisplayName(profile) || currentUser.displayName || 'Candidate',
        yearsValue,
        { targetRole: roleValue, interviewFocus: 'mixed' },
      );

      const sessionId = response.session_id;
      sessionStorage.setItem(`interview_type_${sessionId}`, 'resume');
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start resume deep-dive';
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden pb-14 pt-10">
      <ResumePreviewOverlay
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        version={version}
        entryName={entry?.name}
      />

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

      <div
        className="pointer-events-none absolute -top-20 left-1/3 h-[360px] w-[360px] rounded-full bg-[var(--color-primary)]/10 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-1/4 h-[280px] w-[280px] rounded-full bg-[var(--color-tertiary)]/10 blur-[140px]"
        aria-hidden
      />

      <div className="app-container relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-8">
        <motion.header {...getHeaderMotion(reduceMotion)} className="flex flex-col gap-6">
          <Link
            to="/ai-interview"
            className="inline-flex w-fit items-center gap-2 type-label-sm text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All interview modes
          </Link>

          <div className="flex flex-col gap-5 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
                AI Interview
              </p>
              <h1 className="type-headline-lg mt-2 text-[var(--color-on-surface)] md:type-display-lg">
                Resume deep-dive setup
              </h1>
              <p className="type-body-md mt-3 text-[var(--color-on-surface-variant)]">
                Calibrate how deeply the AI probes your résumé—ownership, tradeoffs, and impact—before
                you enter the live session.
              </p>
            </div>
            <SetupProgressSteps activeStep={1} />
          </div>
        </motion.header>

        <div className="grid grid-cols-12 items-stretch gap-6">
          <motion.section
            {...getCardMotion(reduceMotion, 0)}
            className="glass-panel col-span-12 flex flex-col rounded-2xl p-5 md:p-6 lg:col-span-5"
            aria-labelledby="selected-document-heading"
          >
            <SectionHeading
              id="selected-document-heading"
              title="Selected document"
              icon={FileText}
              accent="primary"
            />
            <SelectedDocumentCard
              loading={loadingResume}
              profile={profile}
              entry={entry}
              version={version}
              integrityScore={integrityScore}
              uploadedLabel={uploadedLabel}
              onPreview={handleOpenPreview}
            />
          </motion.section>

          <motion.div
            {...getCardMotion(reduceMotion, 0.06)}
            className="glass-panel relative z-20 col-span-12 overflow-visible rounded-2xl p-5 md:p-6 lg:col-span-7"
          >
            <AnalysisParametersSection
              objectives={objectives}
              onToggleObjective={toggleObjective}
              scanDepthValue={scanDepthValue}
              onScanDepthChange={setScanDepthValue}
              targetRole={targetRole}
              onTargetRoleChange={setTargetRole}
              targetIndustry={targetIndustry}
              onTargetIndustryChange={setTargetIndustry}
              industryListId={industryListId}
            />
          </motion.div>

          <motion.div
            {...getCardMotion(reduceMotion, 0.12)}
            className="glass-panel col-span-12 rounded-2xl p-5 md:p-6"
          >
            <IntelligenceSettingsSection
              includeMarketTrends={includeMarketTrends}
              onIncludeMarketTrendsChange={setIncludeMarketTrends}
              benchmarkFaang={benchmarkFaang}
              onBenchmarkFaangChange={handleBenchmarkFaangChange}
            />
          </motion.div>
        </div>

        <motion.div {...getCardMotion(reduceMotion, 0.18)}>
          <LaunchFooter
            systemReady={systemReady}
            canLaunch={canLaunch}
            starting={starting}
            onLaunch={handleStart}
          />
        </motion.div>
      </div>

      <datalist id={industryListId}>
        {INDUSTRY_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  );
};

export default ResumeDeepDivePage;
