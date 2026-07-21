import { useCallback, useMemo, useState } from "react";
import { useAuth } from "shared/context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { apiTypeFromCatalogSlug } from "features/interview/domain/modeContract";
import { api } from "shared/services/api";
import { getSkipPrecheck } from "features/interview/preflight/precheckStorage";
import {
  PAIR_PROGRAMMING_DIFFICULTY_STOPS,
  difficultyProgressPercent,
  findDifficultyStop,
} from "features/modes/shared/constants/difficultyStops";
import { PAIR_FOCUS_CHIPS, type PairTrackId } from "../tracks";

export function usePairProgrammingSetup() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [track, setTrack] = useState<PairTrackId>("dsa");
  const [difficultyValue, setDifficultyValue] = useState(2);
  const [focusText, setFocusText] = useState("");
  const [focusChips, setFocusChips] = useState<string[]>([]);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const activeDifficultyStop = useMemo(
    () => findDifficultyStop(PAIR_PROGRAMMING_DIFFICULTY_STOPS, difficultyValue),
    [difficultyValue],
  );
  const difficulty = activeDifficultyStop.api;
  const difficultyLabel = activeDifficultyStop.badge;
  const difficultyProgress = useMemo(
    () => difficultyProgressPercent(difficultyValue, PAIR_PROGRAMMING_DIFFICULTY_STOPS.length),
    [difficultyValue],
  );

  const sessionFocus = useMemo(() => {
    const parts = [...focusChips];
    const free = focusText.trim();
    if (free) parts.push(free);
    return parts.join(", ");
  }, [focusChips, focusText]);

  const canLaunch = track === "dsa" && !starting;

  const toggleFocusChip = useCallback((chip: string) => {
    setFocusChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );
  }, []);

  const handleStartInterview = useCallback(async () => {
    if (!currentUser) {
      toast.error("Please sign in again");
      return;
    }
    if (track !== "dsa") {
      toast.error("That track is coming soon. Choose Data Structures & Algorithms.");
      return;
    }

    setStarting(true);
    try {
      const candidateName =
        currentUser.displayName || currentUser.email?.split("@")[0] || "Candidate";

      const response = await api.startInterview({
        interviewType: apiTypeFromCatalogSlug("pair_programming"),
        difficulty,
        candidateName,
        config: {
          track: "dsa",
          session_focus: sessionFocus || null,
        },
      });

      const sessionId = response.session_id;
      sessionStorage.setItem(`interview_type_${sessionId}`, apiTypeFromCatalogSlug("pair_programming"));
      try {
        window.localStorage.removeItem("interviewConfig");
      } catch {
        /* ignore */
      }

      if (getSkipPrecheck()) {
        navigate(`/interview/${sessionId}`);
        return;
      }

      setPreCheckSessionId(sessionId);
      setShowPreCheck(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to start interview: ${message}`);
    } finally {
      setStarting(false);
    }
  }, [currentUser, difficulty, navigate, sessionFocus, track]);

  const dismissPreCheck = () => {
    setShowPreCheck(false);
    setPreCheckSessionId(null);
  };

  const completePreCheck = () => {
    const id = preCheckSessionId;
    setShowPreCheck(false);
    setPreCheckSessionId(null);
    if (id) navigate(`/interview/${id}`);
  };

  return {
    currentUser,
    track,
    setTrack,
    difficultyValue,
    setDifficultyValue,
    difficultyLabel,
    difficultyProgress,
    difficultyStops: PAIR_PROGRAMMING_DIFFICULTY_STOPS,
    focusText,
    setFocusText,
    focusChips,
    toggleFocusChip,
    focusChipOptions: PAIR_FOCUS_CHIPS,
    canLaunch,
    starting,
    showPreCheck,
    preCheckSessionId,
    handleStartInterview,
    dismissPreCheck,
    completePreCheck,
  };
}
