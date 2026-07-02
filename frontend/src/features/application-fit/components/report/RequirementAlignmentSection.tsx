import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import type {
  ComputeResponse,
  MatchStatus,
  RequirementAlignment,
  RequirementAlignmentV2,
  RequirementAlignmentStatus,
} from '../../types/applicationFitTypes';
import { SkillChipsSection } from './SkillChipsSection';

type RequirementAlignmentSectionProps = {
  report: ComputeResponse;
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  strong: 'Strong',
  partial: 'Partial',
  missing: 'Missing',
  unclear: 'Unclear',
};

const STATUS_PILL: Record<MatchStatus, string> = {
  strong: 'application-fit-status-pill application-fit-status-pill--strong',
  partial: 'application-fit-status-pill application-fit-status-pill--partial',
  missing: 'application-fit-status-pill application-fit-status-pill--missing',
  unclear: 'application-fit-status-pill application-fit-status-pill--unclear',
};

const ROW_SURFACE: Record<MatchStatus, string> = {
  strong: 'application-fit-alignment-row application-fit-alignment-row--strong',
  partial: 'application-fit-alignment-row application-fit-alignment-row--partial',
  missing: 'application-fit-alignment-row application-fit-alignment-row--missing',
  unclear: 'application-fit-alignment-row',
};

const V2_STATUS_TO_LEGACY: Record<RequirementAlignmentStatus, MatchStatus> = {
  met: 'strong',
  partial: 'partial',
  missing: 'missing',
  unknown: 'unclear',
  not_applicable: 'strong',
};

function AlignmentRow({ row }: { row: RequirementAlignment }) {
  const [expanded, setExpanded] = useState(false);
  const evidence = row.resume_evidence?.trim() ?? '';

  return (
    <div className={ROW_SURFACE[row.match_status]}>
      <div className="application-fit-alignment-row__head">
        <div className="application-fit-alignment-row__main">
          <span className={STATUS_PILL[row.match_status]}>{STATUS_LABELS[row.match_status]}</span>
          <span className="type-body-md font-medium leading-snug text-[var(--color-on-surface)]">
            {row.jd_requirement}
          </span>
        </div>
        {evidence ? (
          <button
            type="button"
            className="inline-flex min-h-[1.75rem] shrink-0 items-center gap-1 px-1 type-label-sm text-[var(--color-primary)] hover:opacity-80"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            Evidence
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
      {row.equivalent_terms_found.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-0.5">
          <span className="type-label-sm text-[var(--color-on-surface-variant)]">Matched via</span>
          {row.equivalent_terms_found.map((term) => (
            <span key={term} className="application-fit-term-chip">
              {term}
            </span>
          ))}
        </div>
      ) : null}
      {expanded && evidence ? (
        <blockquote className="application-fit-evidence-quote font-mono text-[var(--color-on-surface-variant)]">
          {evidence}
        </blockquote>
      ) : null}
    </div>
  );
}

function AlignmentRowV2({ row }: { row: RequirementAlignmentV2 }) {
  const legacyStatus = V2_STATUS_TO_LEGACY[row.status];
  const legacyRow: RequirementAlignment = {
    jd_requirement: row.requirement.text,
    match_status: legacyStatus,
    confidence: row.confidence,
    resume_evidence: row.evidence,
    equivalent_terms_found: [],
  };
  return (
    <div>
      <AlignmentRow row={legacyRow} />
      <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1 type-label-sm text-[var(--color-on-surface-variant)]">
        <span className="application-fit-term-chip">{row.requirement.category.replaceAll('_', ' ')}</span>
        <span className="application-fit-term-chip">{row.requirement.importance}</span>
        {row.requirement.is_hard_gate ? <span className="application-fit-term-chip">hard gate</span> : null}
        {row.reason ? <span>{row.reason}</span> : null}
      </div>
    </div>
  );
}

function Group({
  title,
  rows,
  icon,
}: {
  title: string;
  rows: RequirementAlignment[];
  icon?: React.ReactNode;
}) {
  if (!rows.length) return null;
  return (
    <div className="application-fit-alignment-group">
      <h4 className="mb-2.5 flex items-center gap-1.5 type-label-sm uppercase tracking-wider text-[var(--color-on-surface-variant)]">
        {icon}
        {title}
        <span className="font-normal normal-case tracking-normal text-[var(--color-on-surface-variant)]/60">
          ({rows.length})
        </span>
      </h4>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <AlignmentRow key={`${row.jd_requirement}-${index}`} row={row} />
        ))}
      </div>
    </div>
  );
}

export function RequirementAlignmentSection({ report }: RequirementAlignmentSectionProps) {
  if (report.requirement_alignments_v2?.length) {
    const rows = report.requirement_alignments_v2;
    const met = rows.filter((r) => r.status === 'met' || r.status === 'not_applicable');
    const partial = rows.filter((r) => r.status === 'partial');
    const needsWork = rows.filter((r) => r.status === 'missing' || r.status === 'unknown');

    return (
      <section className="glass-panel application-fit-panel">
        <h3 className="application-fit-panel-title type-headline-md text-[var(--color-on-surface)]">
          Requirement Alignment
        </h3>
        <div className="application-fit-alignment-scroll">
          {met.length ? (
            <div className="application-fit-alignment-group">
              <h4 className="mb-2.5 flex items-center gap-1.5 type-label-sm uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                <Check className="h-3.5 w-3.5 text-[var(--color-tertiary)]" aria-hidden />
                Met <span className="font-normal normal-case tracking-normal text-[var(--color-on-surface-variant)]/60">({met.length})</span>
              </h4>
              <div className="flex flex-col gap-3">{met.map((row) => <AlignmentRowV2 key={row.requirement.id} row={row} />)}</div>
            </div>
          ) : null}
          {partial.length ? (
            <div className="application-fit-alignment-group">
              <h4 className="mb-2.5 type-label-sm uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                Partial <span className="font-normal normal-case tracking-normal text-[var(--color-on-surface-variant)]/60">({partial.length})</span>
              </h4>
              <div className="flex flex-col gap-3">{partial.map((row) => <AlignmentRowV2 key={row.requirement.id} row={row} />)}</div>
            </div>
          ) : null}
          {needsWork.length ? (
            <div className="application-fit-alignment-group">
              <h4 className="mb-2.5 type-label-sm uppercase tracking-wider text-[var(--color-on-surface-variant)]">
                Missing or unknown <span className="font-normal normal-case tracking-normal text-[var(--color-on-surface-variant)]/60">({needsWork.length})</span>
              </h4>
              <div className="flex flex-col gap-3">{needsWork.map((row) => <AlignmentRowV2 key={row.requirement.id} row={row} />)}</div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const useFallbackView =
    report.alignment_mode === 'fallback' || !report.requirement_alignments?.length;

  if (useFallbackView) {
    return (
      <div className="flex flex-col gap-3">
        {report.warnings.includes('alignment_fallback') || report.alignment_mode === 'fallback' ? (
          <div className="application-fit-notice type-body-md">
            Requirement alignment used keyword fallback — semantic matching was unavailable.
          </div>
        ) : null}
        <SkillChipsSection report={report} />
      </div>
    );
  }

  const rows = report.requirement_alignments;
  const strong = rows.filter((r) => r.match_status === 'strong');
  const partial = rows.filter((r) => r.match_status === 'partial');
  const missing = rows.filter((r) => r.match_status === 'missing' || r.match_status === 'unclear');

  return (
    <section className="glass-panel application-fit-panel">
      <h3 className="application-fit-panel-title type-headline-md text-[var(--color-on-surface)]">
        Requirement Alignment
      </h3>
      <div className="application-fit-alignment-scroll">
        <Group title="Strong" rows={strong} icon={<Check className="h-3.5 w-3.5 text-[var(--color-tertiary)]" aria-hidden />} />
        <Group title="Partial" rows={partial} />
        <Group title="Missing" rows={missing} />
      </div>
    </section>
  );
}
