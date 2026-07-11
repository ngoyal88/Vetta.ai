import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import Modal from 'shared/components/Modal';

type ConfirmDialogOptions = {
  title?: string;
  message: string;
  onConfirm?: () => void | Promise<void>;
  destructive?: boolean;
};

type ConfirmDialogState = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  destructive: boolean;
};

type ConfirmDialogContextValue = {
  confirmDialog: (options: ConfirmDialogOptions) => void;
  close: () => void;
};

const NOOP = () => {};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function useConfirmDialog(): ConfirmDialogContextValue {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    onConfirm: NOOP,
    destructive: false,
  });

  const confirmDialog = useCallback(({ title = 'Confirm', message, onConfirm = NOOP, destructive = false }: ConfirmDialogOptions) => {
    setState({
      open: true,
      title,
      message,
      onConfirm,
      destructive,
    });
  }, []);

  const close = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    void state.onConfirm();
    close();
  }, [close, state]);

  const value = useMemo(
    () => ({
      confirmDialog,
      close,
    }),
    [close, confirmDialog],
  );

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <Modal open={state.open} onClose={close} title={state.title}>
        <p className="type-body-md mb-6 text-[var(--color-on-surface-variant)]">{state.message}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--color-surface-container-low)]/70 px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface)] transition-[border-color,background-color,color] duration-150 hover:border-[var(--color-primary)]/25 hover:bg-[var(--color-surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={[
              'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-[background-color,box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-0)]',
              state.destructive
                ? 'bg-[var(--color-error-container)] text-[var(--color-on-error-container)] hover:opacity-95 focus-visible:ring-[var(--color-error)]'
                : 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-95 focus-visible:ring-[var(--color-primary)]',
            ].join(' ')}
          >
            Confirm
          </button>
        </div>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}
