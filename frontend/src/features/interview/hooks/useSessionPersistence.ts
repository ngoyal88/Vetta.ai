import { useCallback, useRef } from "react";
import { codeBackupKey, codeLangKey } from "./utils/sessionKeys";
import { persistFeedback } from "./utils/feedbackPersistence";
import type { FeedbackPayload, OptionsRef } from "../types";

export const useSessionPersistence = (sessionId: string, optionsRef: OptionsRef) => {
  const tabHiddenAtRef = useRef<number | null>(null);

  const backupCodeFromEditor = useCallback(() => {
    const editor = optionsRef.current?.codeEditorRef?.current;
    if (!editor || typeof editor.getValue !== "function") return;
    const value = editor.getValue?.() ?? "";
    const lang = typeof editor.getLanguage === "function" ? editor.getLanguage() : "";
    try {
      localStorage.setItem(codeBackupKey(sessionId), value ?? "");
      localStorage.setItem(codeLangKey(sessionId), lang ?? "");
    } catch (_) {}
  }, [optionsRef, sessionId]);

  const restoreCodeToEditor = useCallback(
    (notify = true) => {
      const editor = optionsRef.current?.codeEditorRef?.current;
      if (!editor || typeof editor.getValue !== "function") return false;
      const backup = localStorage.getItem(codeBackupKey(sessionId));
      if (backup == null || backup === "") return false;
      if (editor.getValue()?.trim()) return false;
      editor.setValue?.(backup);
      const langBackup = localStorage.getItem(codeLangKey(sessionId));
      if (typeof editor.setLanguage === "function" && langBackup) {
        editor.setLanguage(langBackup);
      }
      if (notify) {
        const addBanner = optionsRef.current?.addBanner;
        if (typeof addBanner === "function") {
          addBanner("success", "Your code has been restored.", 3000);
        }
      }
      return true;
    },
    [optionsRef, sessionId]
  );

  const handleVisibilityChange = useCallback(
    (onSuspendAudio?: () => void, onResumeAudio?: () => void) => {
      if (document.hidden) {
        tabHiddenAtRef.current = Date.now();
        onSuspendAudio?.();
        backupCodeFromEditor();
      } else {
        onResumeAudio?.();
        const hiddenAt = tabHiddenAtRef.current;
        if (hiddenAt != null) {
          const durationMs = Date.now() - hiddenAt;
          tabHiddenAtRef.current = null;
          const addBanner = optionsRef.current?.addBanner;
          if (typeof addBanner === "function") {
            if (durationMs > 300000) {
              addBanner("info", `You were away for ${Math.round(durationMs / 60000)} minutes. Your progress is saved.`);
            } else if (durationMs > 5000) {
              addBanner("info", "You were away for a moment. Your progress is saved.");
            }
          }
        }
      }
    },
    [backupCodeFromEditor, optionsRef]
  );

  const persistFeedbackPayload = useCallback((payload: FeedbackPayload) => persistFeedback(sessionId, payload), [sessionId]);

  return {
    handleVisibilityChange,
    backupCodeFromEditor,
    restoreCodeToEditor,
    persistFeedbackPayload,
  };
};
