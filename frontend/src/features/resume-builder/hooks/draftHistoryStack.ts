import type { DraftSnapshot } from '../utils/draftSnapshot';
import { snapshotsEqual } from '../utils/draftSnapshot';

export type HistoryMode = 'immediate' | 'debounced' | 'skip';

export const HISTORY_DEBOUNCE_MS = 800;
export const HISTORY_MAX_ENTRIES = 40;

export type DraftHistoryStack = {
  canUndo: () => boolean;
  canRedo: () => boolean;
  recordBeforeChange: (snapshot: DraftSnapshot, mode: Exclude<HistoryMode, 'skip'>) => void;
  undo: (current: DraftSnapshot) => DraftSnapshot | null;
  redo: (current: DraftSnapshot) => DraftSnapshot | null;
  clear: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  onBurstIdle: () => void;
};

export function createDraftHistoryStack(
  maxEntries = HISTORY_MAX_ENTRIES,
  debounceMs = HISTORY_DEBOUNCE_MS,
): DraftHistoryStack {
  let undoStack: DraftSnapshot[] = [];
  let redoStack: DraftSnapshot[] = [];
  let recording = true;
  let burstCaptured = false;
  let burstTimer: ReturnType<typeof setTimeout> | null = null;

  const pushUndo = (snapshot: DraftSnapshot) => {
    const top = undoStack[undoStack.length - 1];
    if (top && snapshotsEqual(top, snapshot)) return;
    undoStack.push(snapshot);
    if (undoStack.length > maxEntries) {
      undoStack = undoStack.slice(undoStack.length - maxEntries);
    }
    redoStack = [];
  };

  const clearBurstTimer = () => {
    if (burstTimer) {
      clearTimeout(burstTimer);
      burstTimer = null;
    }
  };

  const scheduleBurstEnd = () => {
    clearBurstTimer();
    burstTimer = setTimeout(() => {
      burstCaptured = false;
      burstTimer = null;
    }, debounceMs);
  };

  return {
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    recordBeforeChange(snapshot, mode) {
      if (!recording) return;
      if (mode === 'immediate') {
        clearBurstTimer();
        burstCaptured = false;
        pushUndo(snapshot);
        return;
      }
      if (!burstCaptured) {
        pushUndo(snapshot);
        burstCaptured = true;
      }
      scheduleBurstEnd();
    },
    undo(current) {
      if (undoStack.length === 0) return null;
      const next = undoStack.pop()!;
      redoStack.push(current);
      clearBurstTimer();
      burstCaptured = false;
      return next;
    },
    redo(current) {
      if (redoStack.length === 0) return null;
      const next = redoStack.pop()!;
      undoStack.push(current);
      clearBurstTimer();
      burstCaptured = false;
      return next;
    },
    clear() {
      undoStack = [];
      redoStack = [];
      burstCaptured = false;
      clearBurstTimer();
    },
    pauseRecording() {
      recording = false;
    },
    resumeRecording() {
      recording = true;
    },
    onBurstIdle() {
      burstCaptured = false;
      clearBurstTimer();
    },
  };
}
