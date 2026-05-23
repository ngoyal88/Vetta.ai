import { useCallback, useRef } from "react";
import { codeBackupKey, codeLangKey } from "./utils/sessionKeys";
import { persistFeedback } from "./utils/feedbackPersistence";
import type { FeedbackPayload, OptionsRef } from "../types";

type SessionPersistenceOptions = {
  sendControl?: (message: unknown) => void;
  syncSessionStatus?: () => Promise<{ ended?: boolean; reason?: string } | void>;
  connected?: boolean;
};

export const useSessionPersistence = (
  sessionId: string,
  optionsRef: OptionsRef,
  persistenceOptions: SessionPersistenceOptions = {}
) => {
  const tabHiddenAtRef = useRef<number | null>(null);
  const { sendControl, syncSessionStatus, connected } = persistenceOptions;

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
        if (connected && sendControl) {
          sendControl({ type: "candidate_away" });
        }
        onSuspendAudio?.();
        backupCodeFromEditor();
      } else {
        onResumeAudio?.();
        const hiddenAt = tabHiddenAtRef.current;
        tabHiddenAtRef.current = null;
        if (connected && sendControl) {
          sendControl({ type: "candidate_back" });
        }
        const durationMs = hiddenAt != null ? Date.now() - hiddenAt : 0;
        if (syncSessionStatus) {
          void syncSessionStatus().then((result) => {
            const addBanner = optionsRef.current?.addBanner;
            if (!addBanner || typeof addBanner !== "function") return;
            if (result?.ended) {
              const reason = result.reason || "";
              if (reason === "silence_timeout") {
                addBanner(
                  "warning",
                  "Session ended while you were away (no speech detected).",
                  8000
                );
              } else if (reason === "tab_away_timeout") {
                addBanner(
                  "warning",
                  "Session ended — you were away for more than 10 minutes.",
                  8000
                );
              } else {
                addBanner("info", "Your session has ended.", 6000);
              }
              return;
            }
            if (durationMs > 5000) {
              addBanner("success", "Welcome back — session still in progress.", 4000);
            }
          });
        } else if (durationMs > 5000) {
          const addBanner = optionsRef.current?.addBanner;
          if (typeof addBanner === "function") {
            addBanner("success", "Welcome back — session still in progress.", 4000);
          }
        }
      }
    },
    [backupCodeFromEditor, connected, optionsRef, sendControl, syncSessionStatus]
  );

  const persistFeedbackPayload = useCallback(
    (payload: FeedbackPayload) => persistFeedback(sessionId, payload),
    [sessionId]
  );

  return {
    handleVisibilityChange,
    backupCodeFromEditor,
    restoreCodeToEditor,
    persistFeedbackPayload,
  };
};
