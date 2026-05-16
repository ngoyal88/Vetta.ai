import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import VaultPageHeader from '../components/VaultPageHeader';
import VaultResumePicker, { type VersionSelection } from '../components/VaultResumePicker';
import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { vaultApi } from '../services/vaultApi';
import type { VaultCompareResponse } from '../types';
import { getErrorMessage } from '../utils/vaultUtils';

export interface CompareResultState {
  result: VaultCompareResponse;
  selectionA: VersionSelection;
  selectionB: VersionSelection;
  role?: string;
}

function countComparableVersions(entries: ReturnType<typeof useVaultLibraryContext>['entries']) {
  const totalVersions = entries.reduce((sum, e) => sum + (e.version_count || 0), 0);
  return { totalVersions, canCompare: totalVersions >= 2 || entries.length >= 2 };
}

export default function VaultComparePage() {
  const navigate = useNavigate();
  const { entries } = useVaultLibraryContext();
  const [selectionA, setSelectionA] = useState<VersionSelection | null>(null);
  const [selectionB, setSelectionB] = useState<VersionSelection | null>(null);
  const [role, setRole] = useState('');
  const [comparing, setComparing] = useState(false);

  const stableSetA = useCallback((s: VersionSelection | null) => setSelectionA(s), []);
  const stableSetB = useCallback((s: VersionSelection | null) => setSelectionB(s), []);

  const { canCompare } = useMemo(() => countComparableVersions(entries), [entries]);

  const canSubmit =
    selectionA &&
    selectionB &&
    !(selectionA.resumeId === selectionB.resumeId && selectionA.versionId === selectionB.versionId);

  const handleCompare = async () => {
    if (!selectionA || !selectionB) {
      toast.error('Select two versions');
      return;
    }
    if (selectionA.resumeId === selectionB.resumeId && selectionA.versionId === selectionB.versionId) {
      toast.error('Select two different versions');
      return;
    }

    try {
      setComparing(true);
      const result = await vaultApi.compare(
        selectionA.resumeId,
        selectionB.resumeId,
        role.trim() || undefined,
        selectionA.versionId,
        selectionB.versionId,
      );
      const state: CompareResultState = {
        result,
        selectionA,
        selectionB,
        role: role.trim() || undefined,
      };
      navigate('/resume-vault/compare/result', { state });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Comparison failed'));
    } finally {
      setComparing(false);
    }
  };

  if (!entries.length) {
    return (
      <>
        <VaultPageHeader
          title="Compare resumes"
          subtitle="Choose any two versions — same resume or two different ones"
        />
        <p className="text-sm text-[var(--cream-3)]">
          <Link to="/resume-vault" className="text-[var(--teal-1)]">
            Upload a resume first
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <VaultPageHeader
        title="Compare resumes"
        subtitle="Choose any two versions — same resume or two different ones"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VaultResumePicker label="Resume A" entries={entries} selection={selectionA} onChange={stableSetA} />
        <VaultResumePicker label="Resume B" entries={entries} selection={selectionB} onChange={stableSetB} />
      </div>

      <label className="mt-6 block text-xs text-[var(--cream-3)]">
        Target role (optional)
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Backend Engineer"
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-sm text-[var(--cream-1)] outline-none focus:border-[var(--teal-2)]"
        />
      </label>

      <button
        type="button"
        disabled={!canSubmit || comparing || !canCompare}
        title={!canCompare ? 'Need at least two versions or two resumes' : undefined}
        onClick={() => void handleCompare()}
        className="mt-6 w-full rounded-xl bg-[var(--teal-2)] px-4 py-3 text-sm font-medium text-[var(--cream-0)] disabled:opacity-40 lg:static fixed bottom-4 left-4 right-4 z-20 max-w-[calc(100%-2rem)] lg:max-w-none"
      >
        {comparing ? 'Comparing…' : 'Compare'}
      </button>
    </>
  );
}
