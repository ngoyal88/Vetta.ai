import { Link, useSearchParams } from 'react-router-dom';

import '../application-fit.css';
import { FitHistoryTable } from '../components/history/FitHistoryTable';
import { useApplicationFitHistory } from '../hooks/useApplicationFitHistory';

export default function ApplicationFitHistoryPage() {
  const [params] = useSearchParams();
  const targetRole = params.get('role') ?? '';
  const targetCompany = params.get('company') ?? '';
  const { history, loading, error } = useApplicationFitHistory(targetRole, '');

  return (
    <div className="application-fit-page app-container max-w-[62rem] space-y-6 py-8">
      <header className="space-y-2">
        {targetRole ? (
          <p className="type-label-sm inline-flex items-center rounded-full bg-[var(--color-surface-container-highest)] px-3 py-1 text-[var(--color-on-surface-variant)]">
            {targetRole}
            {targetCompany ? ` @ ${targetCompany}` : ''}
          </p>
        ) : null}
        <h1 className="type-headline-lg text-[var(--color-on-surface)]">
          Fit <span className="text-[var(--color-primary)]">history</span>
        </h1>
        <p className="type-body-lg max-w-2xl text-[var(--color-on-surface-variant)]">
          Review previous runs for this role. Open a snapshot to see the full report.
        </p>
      </header>

      {!targetRole ? (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="type-body-md mb-4 text-[var(--color-on-surface-variant)]">
            Run an analysis from Application Fit first, then return here from the report footer.
          </p>
          <Link to="/application-fit" className="btn-primary inline-flex">
            Go to Application Fit
          </Link>
        </div>
      ) : (
        <FitHistoryTable history={history} loading={loading} error={error} />
      )}

      <Link to="/application-fit" className="btn-ghost inline-flex">
        Back to Application Fit
      </Link>
    </div>
  );
}
