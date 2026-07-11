import Modal from 'shared/components/Modal';

import type { VaultEntry } from '../types';
import { normalizeTagInput } from '../utils/vaultUtils';

interface VaultEditMetaModalProps {
  open: boolean;
  entry: VaultEntry | null;
  editName: string;
  editTags: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const fieldClass =
  'mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-0)] px-3 py-2.5 text-[var(--color-on-surface)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-primary)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]';

export default function VaultEditMetaModal({
  open,
  entry,
  editName,
  editTags,
  saving,
  onNameChange,
  onTagsChange,
  onClose,
  onSave,
}: VaultEditMetaModalProps) {
  return (
    <Modal open={open && Boolean(entry)} onClose={onClose} title="Edit resume details">
      {entry ? (
        <div className="space-y-5 text-[var(--color-on-surface)]">
          <p className="type-body-md text-[var(--color-on-surface-variant)]">
            Update how this resume appears in your library. Version history is unchanged.
          </p>

          <label className="block text-sm">
            <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
              Resume name
            </span>
            <input
              value={editName}
              onChange={(event) => onNameChange(event.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
          </label>

          <label className="block text-sm">
            <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
              Tags (comma-separated)
            </span>
            <input
              value={editTags}
              onChange={(event) => onTagsChange(event.target.value)}
              autoComplete="off"
              placeholder="React, Backend, 2026…"
              className={fieldClass}
            />
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-high)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !editName.trim()}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export { normalizeTagInput };
