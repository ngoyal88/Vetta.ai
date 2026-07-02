import { History, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

type ReportFooterProps = {
  targetRole: string;
  targetCompany: string;
  jobDescription: string;
  onAnalyzeAgain: () => void;
};

export function ReportFooter({
  targetRole,
  targetCompany,
  jobDescription,
  onAnalyzeAgain,
}: ReportFooterProps) {
  const historySearch = new URLSearchParams({ role: targetRole, company: targetCompany });
  if (jobDescription.trim()) {
    historySearch.set('jd', '1');
  }

  return (
    <footer className="application-fit-report-footer flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <p className="m-0 max-w-xl type-label-sm leading-relaxed text-[var(--color-on-surface-variant)] opacity-70">
        Fit estimates are guidance, not hiring guarantees. Projection model based on resume and JD signals.
      </p>
      <div className="flex w-full shrink-0 items-center gap-2.5 md:w-auto">
        <Link
          to={`/application-fit/history?${historySearch.toString()}`}
          className="btn-ghost inline-flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 px-4 md:flex-none"
        >
          <History className="h-4 w-4 shrink-0" aria-hidden />
          View history
        </Link>
        <button
          type="button"
          onClick={onAnalyzeAgain}
          className="btn-primary inline-flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 px-4 md:flex-none"
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          Analyze again
        </button>
      </div>
    </footer>
  );
}
