import '../application-fit.css';
import { useState } from 'react';

import { ResumePreviewOverlay } from 'features/application-fit/components/input/ResumePreviewOverlay';
import { ApplicationFitLoadingCard } from '../components/loading/ApplicationFitLoadingCard';
import { JobDescriptionPanel } from '../components/input/JobDescriptionPanel';
import { ResumeContextCard } from '../components/input/ResumeContextCard';
import { TargetDetailsForm } from '../components/input/TargetDetailsForm';
import { ApplicationFitReport } from '../components/report/ApplicationFitReport';
import { useApplicationFit } from '../hooks/useApplicationFit';

export default function ApplicationFitPage() {
  const [resumePreviewOpen, setResumePreviewOpen] = useState(false);
  const {
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
  } = useApplicationFit();

  if (view === 'loading') {
    return (
      <div className="application-fit-page app-container flex min-h-[60vh] items-center justify-center py-8">
        <ApplicationFitLoadingCard />
      </div>
    );
  }

  if (view === 'report' && report) {
    return (
      <div className="application-fit-page application-fit-report app-container flex flex-col gap-5 py-8">
        <ApplicationFitReport
          report={report}
          targetRole={targetRole}
          targetCompany={targetCompany}
          jobDescription={jobDescription}
          onAnalyzeAgain={analyzeAgain}
        />
      </div>
    );
  }

  return (
    <div className="application-fit-page app-container flex flex-col gap-6 py-8">
      <header className="space-y-2">
        <h1 className="type-headline-lg text-[var(--color-on-surface)]">
          Application <span className="text-[var(--color-primary)]">Fit</span>
        </h1>
        <p className="type-body-lg max-w-2xl text-[var(--color-on-surface-variant)]">
          See where you pass ATS, recruiter scan, and HM review — before you apply.
        </p>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <ResumeContextCard
            entry={entry}
            version={version}
            loading={resumeLoading}
            onPreviewResume={() => setResumePreviewOpen(true)}
          />
          <TargetDetailsForm
            targetRole={targetRole}
            targetCompany={targetCompany}
            onRoleChange={setTargetRole}
            onCompanyChange={setTargetCompany}
          />
        </div>
        <div className="flex min-h-[420px] flex-col lg:col-span-7 lg:min-h-[28rem]">
          <JobDescriptionPanel
            value={jobDescription}
            onChange={setJobDescription}
            onClear={() => setJobDescription('')}
            canAnalyze={canAnalyze}
            onAnalyze={() => void analyzeFit()}
          />
        </div>
      </div>

      <ResumePreviewOverlay
        open={resumePreviewOpen}
        onClose={() => setResumePreviewOpen(false)}
        version={version}
        entryName={version?.source_filename || entry?.name || 'Resume'}
      />
    </div>
  );
}
