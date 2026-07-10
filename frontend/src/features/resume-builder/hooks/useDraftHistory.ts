import { useCallback, useMemo, useRef, useState } from 'react';

import { createDraftHistoryStack, type HistoryMode } from './draftHistoryStack';
import type { DraftSnapshot } from '../utils/draftSnapshot';

export function useDraftHistory() {
  const stackRef = useRef(createDraftHistoryStack());
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((value) => value + 1), []);

  const recordBeforeChange = useCallback(
    (snapshot: DraftSnapshot, mode: Exclude<HistoryMode, 'skip'>) => {
      stackRef.current.recordBeforeChange(snapshot, mode);
      bump();
    },
    [bump],
  );

  const undo = useCallback(
    (current: DraftSnapshot) => {
      const result = stackRef.current.undo(current);
      bump();
      return result;
    },
    [bump],
  );

  const redo = useCallback(
    (current: DraftSnapshot) => {
      const result = stackRef.current.redo(current);
      bump();
      return result;
    },
    [bump],
  );

  const clear = useCallback(() => {
    stackRef.current.clear();
    bump();
  }, [bump]);

  const pauseRecording = useCallback(() => stackRef.current.pauseRecording(), []);
  const resumeRecording = useCallback(() => stackRef.current.resumeRecording(), []);

  const canUndo = stackRef.current.canUndo();
  const canRedo = stackRef.current.canRedo();

  return useMemo(
    () => ({
      recordBeforeChange,
      undo,
      redo,
      clear,
      pauseRecording,
      resumeRecording,
      canUndo,
      canRedo,
      revision,
    }),
    [canRedo, canUndo, clear, pauseRecording, recordBeforeChange, redo, resumeRecording, revision, undo],
  );
}
