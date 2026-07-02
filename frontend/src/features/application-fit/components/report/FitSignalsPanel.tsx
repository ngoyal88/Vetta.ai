import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';

import type {
  CategoryScore,
  ComputeResponse,
  GateStatus,
  RequirementAlignmentV2,
} from '../../types/applicationFitTypes';

const GATE_COPY: Record<GateStatus, { label: string; detail: string; className: string }> = {
  clear: {
    label: 'Gate clear',
    detail: 'No blocking requirement is currently visible.',
    className: 'application-fit-gate application-fit-gate--clear',
  },
  risky: {
    label: 'Gate risky',
    detail: 'A required fact is not shown in your profile.',
    className: 'application-fit-gate application-fit-gate--risky',
  },
  blocked: {
    label: 'Gate blocked',
    detail: 'A required gate appears unmet.',
    className: 'application-fit-gate application-fit-gate--blocked',
  },
};

const CATEGORY_LABELS: Record<CategoryScore['category'], string> = {
  technical: 'Technical',
  experience: 'Experience',
  education: 'Education',
  certifications: 'Certifications',
  domain: 'Domain',
  logistics: 'Logistics',
  leadership: 'Leadership',
  resume_signal: 'Resume signal',
};

function CategoryMeter({ item }: { item: CategoryScore }) {
  return (
    <div className="application-fit-category-meter">
      <div className="flex items-center justify-between gap-3">
        <span className="type-label-md text-[var(--color-on-surface)]">{CATEGORY_LABELS[item.category]}</span>
        <span className="font-mono text-sm text-[var(--color-on-surface-variant)]">{item.score}%</span>
      </div>
      <div className="application-fit-category-meter__track" aria-hidden>
        <div className="application-fit-category-meter__bar" style={{ width: `${item.score}%` }} />
      </div>
      <p className="type-label-sm text-[var(--color-on-surface-variant)]">
        {item.met} met · {item.partial} partial · {item.missing} missing · {item.unknown} unknown
      </p>
    </div>
  );
}

function SignalList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: ReactNode;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 type-label-sm uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {icon}
        {title}
      </h4>
      <ul className="flex flex-col gap-2">
        {items.slice(0, 4).map((item) => (
          <li key={item} className="application-fit-signal-row type-body-sm text-[var(--color-on-surface-variant)]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function pickExperienceYearsRow(
  rows: RequirementAlignmentV2[] | undefined,
): RequirementAlignmentV2 | null {
  if (!rows?.length) return null;
  return (
    rows.find(
      (row) =>
        row.requirement.category === 'experience' &&
        /\d/.test(row.requirement.text) &&
        (row.requirement.text.toLowerCase().includes('year') ||
          row.requirement.text.toLowerCase().includes('yr')),
    ) ?? null
  );
}

function ExperienceSummaryLine({ row }: { row: RequirementAlignmentV2 }) {
  const jdText = row.requirement.text.trim();
  const profileText = row.evidence?.trim() || 'not shown in profile';
  return (
    <p className="mb-4 type-body-sm text-[var(--color-on-surface-variant)]">
      <span className="type-label-md text-[var(--color-on-surface)]">Experience: </span>
      JD: {jdText} · Profile: {profileText}
      {row.reason ? ` — ${row.reason}` : ''}
    </p>
  );
}

export function FitSignalsPanel({ report }: { report: ComputeResponse }) {
  const gate = GATE_COPY[report.gate_status ?? 'clear'];
  const experienceRow = pickExperienceYearsRow(report.requirement_alignments_v2);
  const hasV2Signals =
    report.category_scores?.length ||
    report.hard_gate_findings?.length ||
    report.unknown_signals?.length ||
    report.score_reducers?.length ||
    report.score_strengths?.length;

  if (!hasV2Signals) return null;

  return (
    <section className="glass-panel application-fit-panel">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="application-fit-panel-title !mb-1 type-headline-md text-[var(--color-on-surface)]">
            Fit Signals
          </h3>
          <p className="type-body-sm text-[var(--color-on-surface-variant)]">
            Unknown means the detail is not shown in your profile, not that you lack it.
          </p>
        </div>
        <div className={gate.className}>
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <div>
            <p className="type-label-md text-[var(--color-on-surface)]">{gate.label}</p>
            <p className="type-label-sm text-[var(--color-on-surface-variant)]">{gate.detail}</p>
          </div>
        </div>
      </div>

      {experienceRow ? <ExperienceSummaryLine row={experienceRow} /> : null}

      {report.hard_gate_findings?.length ? (
        <div className="mb-4 application-fit-hard-gates">
          {report.hard_gate_findings.map((gateFinding) => (
            <div key={`${gateFinding.requirement}-${gateFinding.status}`} className="application-fit-signal-row">
              <span className="type-label-sm uppercase text-[var(--color-error)]">{gateFinding.status}</span>
              <span className="type-body-sm text-[var(--color-on-surface)]">{gateFinding.requirement}</span>
              {gateFinding.reason ? (
                <span className="type-body-sm text-[var(--color-on-surface-variant)]">{gateFinding.reason}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {report.category_scores?.length ? (
        <div className="application-fit-category-grid">
          {report.category_scores.map((item) => (
            <CategoryMeter key={item.category} item={item} />
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SignalList title="Strengths" items={report.score_strengths ?? []} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <SignalList title="Score reducers" items={report.score_reducers ?? []} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <SignalList title="Unknown" items={report.unknown_signals ?? []} icon={<HelpCircle className="h-3.5 w-3.5" />} />
      </div>
    </section>
  );
}
