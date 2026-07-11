export type SaveState = 'synced' | 'dirty' | 'saving' | 'save_failed';

/** Wait this long after the last edit before persisting (debounce resets per change). */
export const AUTOSAVE_DEBOUNCE_MS = 1500;

export function resolveSaveState(dirty: boolean, phase: 'idle' | 'saving' | 'failed'): SaveState {
  if (phase === 'saving') return 'saving';
  if (phase === 'failed') return 'save_failed';
  if (dirty) return 'dirty';
  return 'synced';
}
