import type { ComputeResponse } from '../../types/applicationFitTypes';
import { BottleneckHero } from './BottleneckHero';
import { FunnelTimeline } from './FunnelTimeline';
import { FitSignalsPanel } from './FitSignalsPanel';
import { MetricsRow } from './MetricsRow';
import { RankedActionList } from './RankedActionList';
import { ReportFooter } from './ReportFooter';
import { RequirementAlignmentSection } from './RequirementAlignmentSection';

type ApplicationFitReportProps = {
  report: ComputeResponse;
  targetRole: string;
  targetCompany: string;
  jobDescription: string;
  onAnalyzeAgain: () => void;
};

export function ApplicationFitReport({
  report,
  targetRole,
  targetCompany,
  jobDescription,
  onAnalyzeAgain,
}: ApplicationFitReportProps) {
  return (
    <div className="application-fit-report flex flex-col gap-5">
      {report.warnings.includes('extraction_fallback') ? (
        <div className="application-fit-notice type-body-md">
          JD extraction used a fallback mode — results may be less precise.
        </div>
      ) : null}

      <BottleneckHero report={report} targetRole={targetRole} />
      <MetricsRow report={report} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 min-w-0">
          <RankedActionList report={report} targetRole={targetRole} />
        </div>
        <div className="lg:col-span-7 min-w-0 lg:sticky lg:top-6">
          <FunnelTimeline report={report} />
        </div>
      </div>

      <FitSignalsPanel report={report} />
      <RequirementAlignmentSection report={report} />

      <ReportFooter
        targetRole={targetRole}
        targetCompany={targetCompany}
        jobDescription={jobDescription}
        onAnalyzeAgain={onAnalyzeAgain}
      />
    </div>
  );
}
