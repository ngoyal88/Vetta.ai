import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';

import VaultEditMetaModal from '../components/VaultEditMetaModal';
import VaultPageHeader from '../components/VaultPageHeader';
import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { useVaultVersions } from '../hooks/useVaultVersions';
import { formatTimestamp, getErrorMessage, normalizeTagInput } from '../utils/vaultUtils';

export default function VaultVersionsPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();
  const { entries, updateMeta } = useVaultLibraryContext();
  const { versions, loading, error, refresh } = useVaultVersions(resumeId);

  const entry = entries.find((e) => e.id === resumeId);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const openEdit = () => {
    if (!entry) return;
    setEditName(entry.name);
    setEditTags((entry.tags || []).join(', '));
    setEditOpen(true);
  };

  const handleSaveMeta = async () => {
    if (!resumeId || !editName.trim()) {
      toast.error('Resume name cannot be blank');
      return;
    }
    try {
      setSavingMeta(true);
      await updateMeta(resumeId, { name: editName.trim(), tags: normalizeTagInput(editTags) });
      setEditOpen(false);
      toast.success('Resume updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally {
      setSavingMeta(false);
    }
  };

  if (!resumeId) {
    return <p className="text-sm text-[var(--cream-3)]">Invalid resume</p>;
  }

  if (!loading && !entry && entries.length > 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-8 text-center">
        <p className="text-sm text-[var(--cream-2)]">Resume not found</p>
        <Link to="/resume-vault/library" className="mt-4 inline-block text-sm text-[var(--teal-1)]">
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <VaultPageHeader
          title={entry?.name || 'Resume'}
          subtitle={
            entry
              ? `${entry.version_count} versions · score ${entry.scorecard?.score ?? '—'}${entry.is_active ? ' · active' : ''}`
              : 'Loading…'
          }
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openEdit}
            disabled={!entry}
            className="rounded-full border border-[var(--border)] bg-[var(--bg-1)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--cream-2)] hover:border-[var(--teal-2)] disabled:opacity-40"
          >
            Edit
          </button>
          <Link
            to={`/resume-vault?resumeId=${encodeURIComponent(resumeId)}`}
            className="rounded-full bg-[var(--teal-2)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--cream-0)]"
          >
            + Version
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[var(--bg-2)]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6 text-center">
          <p className="text-sm text-[var(--red-1)]">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 text-xs uppercase tracking-[0.12em] text-[var(--teal-1)]"
          >
            Retry
          </button>
        </div>
      ) : !versions.length ? (
        <p className="text-sm text-[var(--cream-3)]">No versions yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {versions.map((version) => {
            const isCurrent = entry?.current_version_id === version.id;
            return (
              <button
                key={version.id}
                type="button"
                onClick={() => navigate(`/resume-vault/r/${resumeId}/${version.id}`)}
                className={[
                  'rounded-2xl border p-4 text-left transition',
                  isCurrent
                    ? 'border-[var(--teal-2)]/60 bg-[var(--emerald-dim)]'
                    : 'border-[var(--border)] bg-[var(--bg-1)] hover:border-[var(--teal-2)]/40',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <FileText className="h-5 w-5 text-[var(--teal-1)]" />
                  {isCurrent ? (
                    <span className="rounded-full border border-[var(--emerald-border)] bg-[var(--emerald-dim)] px-2 py-0.5 text-[10px] text-[var(--teal-1)]">
                      current
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium text-[var(--cream-0)]">version {version.version_number}</p>
                <p className="mt-1 text-[10px] text-[var(--cream-4)]">{formatTimestamp(version.created_at)}</p>
                {version.source_filename ? (
                  <p className="mt-1 truncate text-[10px] text-[var(--teal-1)]">{version.source_filename}</p>
                ) : null}
                <p className="mt-2 text-xs text-[var(--cream-3)]">
                  score {version.score_at_version ?? '—'}
                  {version.user_note ? ` · ${version.user_note}` : ''}
                </p>
                {version.diff_summary ? (
                  <p className="mt-2 line-clamp-2 text-xs text-[var(--cream-4)]">{version.diff_summary}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <VaultEditMetaModal
        entry={editOpen ? entry || null : null}
        editName={editName}
        editTags={editTags}
        saving={savingMeta}
        onNameChange={setEditName}
        onTagsChange={setEditTags}
        onClose={() => setEditOpen(false)}
        onSave={() => void handleSaveMeta()}
      />
    </>
  );
}
