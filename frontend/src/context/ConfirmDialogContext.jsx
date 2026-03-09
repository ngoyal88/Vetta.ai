import React, { createContext, useContext, useState, useCallback } from 'react';
import Modal from '../components/Modal';

const ConfirmDialogContext = createContext(null);

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return ctx;
}

export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    destructive: false,
  });

  const confirmDialog = useCallback(({ title = 'Confirm', message, onConfirm, destructive = false }) => {
    setState({
      open: true,
      title,
      message,
      onConfirm: onConfirm || (() => {}),
      destructive,
    });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    state.onConfirm?.();
    close();
  }, [state, close]);

  return (
    <ConfirmDialogContext.Provider value={{ confirmDialog, close }}>
      {children}
      <Modal open={state.open} onClose={close} title={state.title}>
        <p className="text-gray-300 mb-6">{state.message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg font-medium transition focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              state.destructive
                ? 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-400'
                : 'bg-cyan-600 text-black hover:bg-cyan-500 focus:ring-cyan-400'
            }`}
          >
            Confirm
          </button>
        </div>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}
