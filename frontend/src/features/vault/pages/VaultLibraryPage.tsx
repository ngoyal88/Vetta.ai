import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Folder, MoreVertical, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import VaultPageHeader from '../components/VaultPageHeader';
import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { getErrorMessage } from '../utils/vaultUtils';

export default function VaultLibraryPage() {
  const navigate = useNavigate();
  const { entries, meta, loading, error, refresh, setActive, deleteEntry } = useVaultLibraryContext();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const handleSetActive = async (resumeId: string) => {
    try {
      setPendingAction(`active-${resumeId}`);
      await setActive(resumeId);
      toast.success('Active resume updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to set active'));
    } finally {
      setPendingAction(null);
      setMenuOpen(null);
    }
  };

  const handleDelete = async (resumeId: string) => {
    if (!window.confirm('Delete this resume and all versions?')) return;
    try {
      setPendingAction(`delete-${resumeId}`);
      await deleteEntry(resumeId);
      toast.success('Resume deleted');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete'));
    } finally {
      setPendingAction(null);
      setMenuOpen(null);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <VaultPageHeader
          title="Library"
          subtitle="All resumes in your vault"
          resumeCount={meta.resume_count ?? entries.length}
        />
        <Link
          to="/resume-vault"
          className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-1)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--cream-2)] hover:border-[var(--teal-2)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Upload
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--cream-3)]">Loading library…</p>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6 text-center">
          <p className="text-sm text-[var(--red-1)]">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--cream-2)]"
          >
            Retry
          </button>
        </div>
      ) : !entries.length ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-1)] px-6 py-16 text-center">
          <p className="text-sm text-[var(--cream-2)]">No resumes yet — upload your first one</p>
          <Link
            to="/resume-vault"
            className="mt-4 inline-block text-sm text-[var(--teal-1)] hover:text-[var(--cream-0)]"
          >
            Go to upload →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const isActive = entry.is_active || meta.active_resume_id === entry.id;
            return (
              <li
                key={entry.id}
                className="group relative rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] transition hover:border-[var(--teal-2)]/40 hover:bg-[var(--bg-2)]"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/resume-vault/r/${entry.id}`)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left"
                >
                  <Folder className="h-5 w-5 shrink-0 text-[var(--teal-1)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--cream-0)]">{entry.name}</span>
                      {isActive ? (
                        <span className="rounded-full border border-[var(--emerald-border)] bg-[var(--emerald-dim)] px-2 py-0.5 text-[10px] text-[var(--teal-1)]">
                          active
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--cream-4)]">
                      v{entry.version_count} · score {entry.scorecard?.score ?? '—'}
                      {entry.tags?.length ? ` · ${entry.tags.join(', ')}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cream-4)]" />
                </button>
                <div className="absolute right-3 top-3">
                  <button
                    type="button"
                    aria-label="Row actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === entry.id ? null : entry.id);
                    }}
                    className="rounded-lg p-1 text-[var(--cream-4)] hover:bg-[var(--bg-0)] hover:text-[var(--cream-1)]"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen === entry.id ? (
                    <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-[var(--border)] bg-[var(--bg-0)] py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => void handleSetActive(entry.id)}
                        disabled={pendingAction === `active-${entry.id}`}
                        className="block w-full px-3 py-2 text-left text-xs text-[var(--cream-2)] hover:bg-[var(--bg-2)]"
                      >
                        Set active
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(entry.id)}
                        disabled={pendingAction === `delete-${entry.id}`}
                        className="block w-full px-3 py-2 text-left text-xs text-[var(--red-1)] hover:bg-[var(--bg-2)]"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
