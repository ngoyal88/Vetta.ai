import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import VaultDocumentViewer from '../components/VaultDocumentViewer';
import type { CompareResultState } from './VaultComparePage';
import type { VaultVersion } from '../types';

export default function VaultCompareResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as CompareResultState | null;
  const [mobileTab, setMobileTab] = useState<'documents' | 'analysis'>('documents');

  useEffect(() => {
    if (!state?.result) {
      toast.error('Select resumes again to run the comparison.');
      navigate('/resume-vault/compare', { replace: true });
    }
  }, [state, navigate]);

  if (!state?.result) {
    return null;
  }

  const { result, selectionA, selectionB } = state;
  const versionA: VaultVersion = selectionA.version;
  const versionB: VaultVersion = selectionB.version;

  const nameA = result.resume_a_name || selectionA.entry.name;
  const nameB = result.resume_b_name || selectionB.entry.name;
  const vNumA = result.version_a_number ?? versionA.version_number;
  const vNumB = result.version_b_number ?? versionB.version_number;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--teal-1)]">Compare result</p>
          <h1 className="mt-2 text-xl font-medium text-[var(--cream-0)]">
            {nameA} v{vNumA} vs {nameB} v{vNumB}
          </h1>
          <p className="mt-2 text-sm text-[var(--cream-3)]">
            Score {result.score_a} vs {result.score_b}
            {result.recommended_id ? (
              <span className="ml-2 rounded-full border border-[var(--emerald-border)] bg-[var(--emerald-dim)] px-2 py-0.5 text-[10px] text-[var(--teal-1)]">
                Recommended: {result.recommended_id === 'a' ? 'A' : 'B'}
              </span>
            ) : null}
          </p>
        </div>
        <Link
          to="/resume-vault/compare"
          className="text-xs uppercase tracking-[0.12em] text-[var(--teal-1)] hover:text-[var(--cream-0)]"
        >
          ← Back to compare
        </Link>
      </div>

      <div className="mb-4 flex gap-2 lg:hidden">
        {(['documents', 'analysis'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={[
              'rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em]',
              mobileTab === tab
                ? 'border-[var(--teal-2)] bg-[var(--emerald-dim)] text-[var(--cream-0)]'
                : 'border-[var(--border)] text-[var(--cream-3)]',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={mobileTab === 'documents' ? 'block space-y-6' : 'hidden lg:block lg:space-y-6'}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cream-4)]">
              {nameA} · v{vNumA}
            </p>
            <VaultDocumentViewer version={versionA} />
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cream-4)]">
              {nameB} · v{vNumB}
            </p>
            <VaultDocumentViewer version={versionB} />
          </div>
        </div>
      </div>

      <div
        className={[
          'rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6',
          mobileTab === 'analysis' ? 'block' : 'hidden lg:block',
        ].join(' ')}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-4)]">
          AI difference analysis
        </p>
        {result.diff_summary ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--cream-1)]">{result.diff_summary}</p>
        ) : null}
        <p className="mt-4 text-sm text-[var(--cream-2)]">{result.recommendation_reason}</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--cream-4)]">Skills only in A</p>
            <p className="mt-1 text-sm text-[var(--cream-2)]">
              {(result.skills_only_in_a || []).join(', ') || 'None'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--cream-4)]">Skills only in B</p>
            <p className="mt-1 text-sm text-[var(--cream-2)]">
              {(result.skills_only_in_b || []).join(', ') || 'None'}
            </p>
          </div>
        </div>
        {result.section_highlights && Object.keys(result.section_highlights).length > 0 ? (
          <div className="mt-4 space-y-2">
            {Object.entries(result.section_highlights).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
                <p className="font-mono text-[10px] uppercase text-[var(--cream-4)]">{key}</p>
                <p className="mt-1 text-sm text-[var(--cream-2)]">{String(value)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to={`/resume-vault/r/${selectionA.resumeId}/${selectionA.versionId}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--cream-2)]"
          >
            Open A detail
          </Link>
          <Link
            to={`/resume-vault/r/${selectionB.resumeId}/${selectionB.versionId}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--cream-2)]"
          >
            Open B detail
          </Link>
        </div>
      </div>
    </>
  );
}
