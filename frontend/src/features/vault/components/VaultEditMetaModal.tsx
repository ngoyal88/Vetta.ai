import React, { useEffect } from 'react';

import type { VaultEntry } from '../types';
import { normalizeTagInput } from '../utils/vaultUtils';

interface VaultEditMetaModalProps {
  entry: VaultEntry | null;
  editName: string;
  editTags: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function VaultEditMetaModal({
  entry,
  editName,
  editTags,
  saving,
  onNameChange,
  onTagsChange,
  onClose,
  onSave,
}: VaultEditMetaModalProps) {
  useEffect(() => {
    if (!entry) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry, onClose]);

  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-1)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cream-4)]">Edit resume</p>
        <h2 className="mt-2 text-lg font-medium text-[var(--cream-0)]">{entry.name}</h2>

        <label className="mt-4 block text-xs text-[var(--cream-3)]">
          Name
          <input
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)] outline-none focus:border-[var(--teal-2)]"
          />
        </label>

        <label className="mt-3 block text-xs text-[var(--cream-3)]">
          Tags (comma-separated)
          <input
            value={editTags}
            onChange={(e) => onTagsChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)] outline-none focus:border-[var(--teal-2)]"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] bg-[var(--bg-2)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--cream-2)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !editName.trim()}
            className="rounded-full bg-[var(--teal-2)] px-4 py-2 text-xs uppercase tracking-[0.12em] text-[var(--cream-0)] disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { normalizeTagInput };
