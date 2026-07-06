import { useEffect, useState } from 'react';

import Modal from 'shared/components/Modal';

type SaveDraftModalProps = {
  open: boolean;
  saving: boolean;
  defaultName: string;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
};

const inputClass =
  'mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-0)] px-3 py-2.5 text-[var(--color-on-surface)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-primary)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]';

export default function SaveDraftModal({
  open,
  saving,
  defaultName,
  onClose,
  onSubmit,
}: SaveDraftModalProps) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (open) {
      setName(defaultName);
    }
  }, [defaultName, open]);

  return (
    <Modal open={open} onClose={onClose} title="Save Draft">
      <div className="space-y-4 text-[var(--color-on-surface)]">
        <p className="type-body-md text-[var(--color-on-surface-variant)]">
          Name this draft so you can find it on the Builder landing page.
        </p>

        <label className="block text-sm">
          <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
            Draft name
          </span>
          <input
            name="builder-draft-name"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim() && !saving) {
                event.preventDefault();
                void onSubmit(name.trim());
              }
            }}
            className={inputClass}
            placeholder="Resume(1)"
          />
        </label>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/70 px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--color-primary)]/25 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit(name.trim())}
            disabled={saving || !name.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition-[background-color,box-shadow,opacity] duration-150 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
