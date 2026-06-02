import React, { useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PreSessionCheckerWithBrowserCheck } from 'features/interview/components/PreSessionChecker';
import { SetupProgressSteps } from 'features/modes/shared/components/SetupProgressSteps';
import { CalibrationSection } from '../components/CalibrationSection';
import { JobDescriptionSection } from '../components/JobDescriptionSection';
import { ResumeContextSection } from '../components/ResumeContextSection';
import { RoleTargetedLaunchFooter } from '../components/RoleTargetedLaunchFooter';
import { TargetRoleSection } from '../components/TargetRoleSection';
import { useRoleTargetedSetup } from '../hooks/useRoleTargetedSetup';
import { getCardMotion, getHeaderMotion } from '../utils/motion';

const RoleTargetedPage: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const setup = useRoleTargetedSetup();

  const headerMotion = useMemo(() => getHeaderMotion(reduceMotion), [reduceMotion]);
  const cardMotion0 = useMemo(() => getCardMotion(reduceMotion, 0), [reduceMotion]);
  const cardMotion1 = useMemo(() => getCardMotion(reduceMotion, 0.06), [reduceMotion]);
  const cardMotion2 = useMemo(() => getCardMotion(reduceMotion, 0.12), [reduceMotion]);
  const cardMotion3 = useMemo(() => getCardMotion(reduceMotion, 0.18), [reduceMotion]);

  const handleLaunch = useCallback(() => {
    void setup.handleStartInterview();
  }, [setup.handleStartInterview]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden pb-14 pt-10">
      {setup.showPreCheck && setup.preCheckSessionId ? (
        <PreSessionCheckerWithBrowserCheck
          sessionId={setup.preCheckSessionId}
          getAuthToken={() => setup.currentUser?.getIdToken?.()}
          onAllPassed={setup.completePreCheck}
          onCancel={setup.dismissPreCheck}
        />
      ) : null}

      <div
        className="pointer-events-none absolute -top-20 left-1/4 h-[320px] w-[320px] rounded-full bg-[var(--color-primary)]/10 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-1/4 h-[280px] w-[280px] rounded-full bg-[var(--color-tertiary)]/10 blur-[140px]"
        aria-hidden
      />

      <div className="app-container relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
        <motion.header {...headerMotion} className="flex flex-col gap-6">
          <Link
            to="/ai-interview"
            className="inline-flex w-fit items-center gap-2 type-label-sm text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All interview modes
          </Link>

          <div className="flex flex-col gap-5 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="type-label-sm uppercase tracking-[0.24em] text-[var(--color-secondary)]">
                AI Interview
              </p>
              <h1 className="type-headline-lg mt-2 text-[var(--color-on-surface)] md:type-display-lg">
                Role-targeted setup
              </h1>
              <p className="type-body-md mt-3 text-[var(--color-on-surface-variant)]">
                Calibrate company, role, and focus so the interviewer mirrors your target loop.
              </p>
            </div>

            <SetupProgressSteps activeStep={1} />
          </div>
        </motion.header>

        <ResumeContextSection
          motionProps={cardMotion0}
          loadingResume={setup.loadingResume}
          parsedResume={setup.parsedResume}
          activeResumeName={setup.activeResumeName}
        />

        <TargetRoleSection
          motionProps={cardMotion1}
          company={setup.company}
          role={setup.role}
          onCompanyChange={setup.setCompany}
          onRoleChange={setup.setRole}
        />

        <JobDescriptionSection
          motionProps={cardMotion2}
          jobDescription={setup.jobDescription}
          jdCharCount={setup.jdCharCount}
          onJobDescriptionChange={setup.setJobDescription}
          onClear={setup.clearJobDescription}
          onUploadClick={setup.handleUploadClick}
        />

        <CalibrationSection
          motionProps={cardMotion3}
          focusSelections={setup.focusSelections}
          difficultyValue={setup.difficultyValue}
          difficultyLabel={setup.difficultyLabel}
          difficultyProgress={setup.difficultyProgress}
          yoeValue={setup.yoeValue}
          yoeLabel={setup.yoeLabel}
          yoeProgress={setup.yoeProgress}
          onToggleFocus={setup.toggleFocus}
          onDifficultyChange={setup.setDifficultyValue}
          onYoeChange={setup.setYoeValue}
        />

        <RoleTargetedLaunchFooter
          canLaunch={setup.canLaunch}
          starting={setup.starting}
          roleValue={setup.roleValue}
          onLaunch={handleLaunch}
        />
      </div>

      <input
        ref={setup.fileInputRef}
        type="file"
        accept=".txt,.md,.text/plain"
        className="hidden"
        onChange={setup.handleUploadFile}
      />
    </div>
  );
};

export default RoleTargetedPage;
