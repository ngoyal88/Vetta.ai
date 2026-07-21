import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { PreSessionCheckerWithBrowserCheck } from 'features/interview/preflight/PreSessionChecker';
import { SetupProgressSteps } from 'features/modes/shared/components/SetupProgressSteps';
import { getCardMotion, getHeaderMotion } from 'features/modes/shared/utils/motion';
import { CalibrationSection } from '../components/CalibrationSection';
import { JobDescriptionSection } from '../components/JobDescriptionSection';
import { ResumeContextSection } from '../components/ResumeContextSection';
import { RoleTargetedLaunchFooter } from '../components/RoleTargetedLaunchFooter';
import { TargetRoleSection } from '../components/TargetRoleSection';
import { useRoleTargetedSetup } from '../hooks/useRoleTargetedSetup';
import { JD_FILE_ACCEPT } from 'shared/utils/jdInputUtils';

const RoleTargetedPage: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const setup = useRoleTargetedSetup();
  const canExtractInsights = setup.roleValue.length >= 2 && setup.jobDescription.trim().length >= 40;

  const handleExtractInsights = () => {
    navigate('/application-fit', {
      state: {
        role: setup.roleValue,
        jobDescription: setup.jobDescription,
        targetCompany: setup.companyValue,
      },
    });
  };

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
        <motion.header {...getHeaderMotion(reduceMotion)} className="flex flex-col gap-6">
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
          motionProps={getCardMotion(reduceMotion, 0)}
          loadingResume={setup.loadingResume}
          parsedResume={setup.parsedResume}
          activeResumeName={setup.activeResumeName}
        />

        <TargetRoleSection
          motionProps={getCardMotion(reduceMotion, 0.06)}
          company={setup.company}
          role={setup.role}
          onCompanyChange={setup.setCompany}
          onRoleChange={setup.setRole}
        />

        <JobDescriptionSection
          motionProps={getCardMotion(reduceMotion, 0.12)}
          jobDescription={setup.jobDescription}
          jdCharCount={setup.jdCharCount}
          onJobDescriptionChange={setup.setJobDescription}
          onClear={setup.clearJobDescription}
          onUploadClick={setup.handleUploadClick}
          uploading={setup.jdUploading}
          onExtractInsights={handleExtractInsights}
          canExtractInsights={canExtractInsights}
        />

        <CalibrationSection
          motionProps={getCardMotion(reduceMotion, 0.18)}
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
          onLaunch={() => void setup.handleStartInterview()}
        />
      </div>

      <input
        ref={setup.fileInputRef}
        type="file"
        accept={JD_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => void setup.handleUploadFile(event)}
      />
    </div>
  );
};

export default RoleTargetedPage;
