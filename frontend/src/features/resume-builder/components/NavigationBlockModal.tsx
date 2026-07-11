import Modal from 'shared/components/Modal';

type NavigationBlockModalProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
};

export default function NavigationBlockModal({ open, onStay, onLeave }: NavigationBlockModalProps) {
  return (
    <Modal open={open} onClose={onStay} title="Leave Resume Builder?">
      <div className="space-y-4">
        <p className="type-body-md text-[var(--color-on-surface-variant)]">
          You have unsaved changes. Leave this page and discard them?
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onStay}
            className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            Stay Here
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg border border-[var(--color-error)] px-4 py-2 text-sm text-[var(--color-error)] transition-[background-color,box-shadow] duration-150 hover:bg-[var(--color-error)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
          >
            Leave
          </button>
        </div>
      </div>
    </Modal>
  );
}

