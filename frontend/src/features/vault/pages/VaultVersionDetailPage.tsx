import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import VaultDocumentViewer from '../components/VaultDocumentViewer';
import VaultInsightsPanel from '../components/VaultInsightsPanel';
import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { vaultApi } from '../services/vaultApi';
import type { VaultVersion } from '../types';
import { getErrorMessage } from '../utils/vaultUtils';

export default function VaultVersionDetailPage() {
  const { resumeId, versionId } = useParams<{ resumeId: string; versionId: string }>();
  const { entries, setActive, restoreVersion, reanalyze } = useVaultLibraryContext();
  const [version, setVersion] = useState<VaultVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState<'insights' | 'document'>('document');
  const [pendingRestore, setPendingRestore] = useState(false);
  const [pendingActive, setPendingActive] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const entry = entries.find((e) => e.id === resumeId);

  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const v = await vaultApi.getVersion(versionId);
        if (cancelled) return;
        if (resumeId && v.resume_id !== resumeId) {
          setError('Version not found');
          setVersion(null);
          return;
        }
        setVersion(v);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load version'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [versionId, resumeId]);

  if (!resumeId || !versionId) {
    return <p className="text-sm text-[var(--cream-3)]">Invalid route</p>;
  }

  if (!loading && error) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-8 text-center">
        <p className="text-sm text-[var(--red-1)]">{error}</p>
        <Link
          to={`/resume-vault/r/${resumeId}`}
          className="mt-4 inline-block text-sm text-[var(--teal-1)]"
        >
          Back to versions
        </Link>
      </div>
    );
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={reanalyzing || !entry}
        onClick={async () => {
          if (!entry) return;
          try {
            setReanalyzing(true);
            await reanalyze(entry.id, versionId);
            const refreshed = await vaultApi.getVersion(versionId);
            setVersion(refreshed);
            toast.success('Re-analyzed');
          } catch (err) {
            toast.error(getErrorMessage(err, 'Re-analysis failed'));
          } finally {
            setReanalyzing(false);
          }
        }}
        className="rounded-full border border-[var(--border)] bg-[var(--bg-1)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--cream-2)]"
      >
        {reanalyzing ? 'Analyzing…' : 'Re-analyze'}
      </button>
      <button
        type="button"
        disabled={pendingRestore}
        onClick={async () => {
          try {
            setPendingRestore(true);
            await restoreVersion(versionId);
            toast.success('Version restored');
          } catch (err) {
            toast.error(getErrorMessage(err, 'Restore failed'));
          } finally {
            setPendingRestore(false);
          }
        }}
        className="rounded-full border border-[var(--border)] bg-[var(--bg-1)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--cream-2)]"
      >
        {pendingRestore ? 'Restoring…' : 'Restore'}
      </button>
      {entry && !entry.is_active ? (
        <button
          type="button"
          disabled={pendingActive}
          onClick={async () => {
            try {
              setPendingActive(true);
              await setActive(entry.id);
              toast.success('Set as active resume');
            } catch (err) {
              toast.error(getErrorMessage(err, 'Failed to set active'));
            } finally {
              setPendingActive(false);
            }
          }}
          className="rounded-full border border-[var(--border)] bg-[var(--bg-1)] px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--cream-2)]"
        >
          {pendingActive ? 'Updating…' : 'Set active'}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-4)]">
          {entry?.name || 'Resume'} · version {version?.version_number ?? '…'}
        </p>
        <div className="mt-4 flex gap-2 lg:hidden">
          {(['document', 'insights'] as const).map((tab) => (
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
      </div>

      {loading ? (
        <p className="text-sm text-[var(--cream-3)]">Loading version…</p>
      ) : (
        <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
          <div className={mobileTab === 'insights' ? 'block' : 'hidden lg:block'}>
            <VaultInsightsPanel
              entry={entry || null}
              version={version}
              scorecard={entry?.scorecard}
              actions={actions}
            />
          </div>
          <div className={mobileTab === 'document' ? 'block' : 'hidden lg:block'}>
            <VaultDocumentViewer version={version} />
          </div>
        </div>
      )}
    </>
  );
}
