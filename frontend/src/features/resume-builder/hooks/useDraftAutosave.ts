import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AUTOSAVE_DEBOUNCE_MS, resolveSaveState, type SaveState } from './draftAutosave';

type UseDraftAutosaveOptions = {
  /**
   * A value that changes whenever savable content changes (e.g. the draft
   * fingerprint). The debounce timer resets whenever this changes, so a save
   * only fires after the user pauses — the correct "save when typing stops"
   * behavior. Keying on a boolean instead would not reset per keystroke.
   */
  signal: string;
  dirty: boolean;
  enabled: boolean;
  onSave: () => Promise<boolean>;
};

/**
 * Debounced, single-flight autosave.
 *
 * - Debounce resets on every content change (keyed on `signal`).
 * - Never runs two saves in parallel; if edits arrive mid-save, exactly one
 *   trailing save runs afterward (latest-wins), so out-of-order writes can't
 *   clobber newer content.
 * - Cancels the pending timer on unmount.
 */
export function useDraftAutosave({ signal, dirty, enabled, onSave }: UseDraftAutosaveOptions) {
  const [phase, setPhase] = useState<'idle' | 'saving' | 'failed'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const dirtyRef = useRef(dirty);
  const enabledRef = useRef(enabled);
  const onSaveRef = useRef(onSave);

  dirtyRef.current = dirty;
  enabledRef.current = enabled;
  onSaveRef.current = onSave;

  const saveState: SaveState = useMemo(() => resolveSaveState(dirty, phase), [dirty, phase]);

  const runSave = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current || !dirtyRef.current) return true;
    // Single-flight: if a save is already running, remember that another is
    // needed and let the in-flight one trigger it when it finishes.
    if (inFlightRef.current) {
      pendingRef.current = true;
      return true;
    }

    inFlightRef.current = true;
    setPhase('saving');
    let ok = false;
    try {
      ok = await onSaveRef.current();
    } catch {
      ok = false;
    } finally {
      inFlightRef.current = false;
    }

    if (!ok) {
      setPhase('failed');
      return false;
    }

    // Edits landed while saving — run exactly one trailing save (latest-wins).
    if (pendingRef.current && dirtyRef.current) {
      pendingRef.current = false;
      return runSave();
    }
    pendingRef.current = false;
    setPhase(dirtyRef.current ? 'dirty' : 'idle');
    return true;
  }, []);

  useEffect(() => {
    if (!dirty && !inFlightRef.current) setPhase('idle');
  }, [dirty]);

  // Debounce keyed on the content signal: each change clears the previous timer
  // and starts a fresh one, so the save fires ~AUTOSAVE_DEBOUNCE_MS after the
  // last edit rather than after the first.
  useEffect(() => {
    if (!enabled || !dirty) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [signal, dirty, enabled, runSave]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /** Persist any pending change immediately (used before preview/latex/publish). */
  const flushAutosave = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return true;
    return runSave();
  }, [runSave]);

  /** Drop a pending debounced save without persisting (manual Save owns the write). */
  const cancelAutosave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { saveState, flushAutosave, cancelAutosave };
}
