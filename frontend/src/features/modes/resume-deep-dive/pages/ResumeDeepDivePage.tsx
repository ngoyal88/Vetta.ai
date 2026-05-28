import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FileSearch } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { useAuth } from "shared/context/AuthContext";
import { api } from "shared/services/api";
import type { ResumeProfile } from "features/vault/types";
import { PreSessionCheckerWithBrowserCheck } from "features/interview/components/PreSessionChecker";
import { getSkipPrecheck } from "features/interview/utils/precheckStorage";
import { vaultApi } from "features/vault/services/vaultApi";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy", desc: "Warm up" },
  { value: "medium", label: "Medium", desc: "Balanced" },
  { value: "hard", label: "Hard", desc: "Stress test" },
];

const ResumeDeepDivePage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [resumeProfile, setResumeProfile] = useState<ResumeProfile | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [difficulty, setDifficulty] = useState("medium");
  const [yearsExperience, setYearsExperience] = useState("");
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadResume = useCallback(async () => {
    setLoadingResume(true);
    try {
      const profile = await vaultApi.getActiveResumeProfile();
      setResumeProfile(profile || null);
    } catch {
      setResumeProfile(null);
    } finally {
      setLoadingResume(false);
    }
  }, []);

  useEffect(() => {
    void loadResume();
  }, [loadResume]);

  const handleStart = async () => {
    if (!currentUser) {
      toast.error("Please sign in again.");
      return;
    }
    if (!resumeProfile) {
      toast.error("Upload and activate a resume in Vault first.");
      return;
    }
    setStarting(true);
    try {
      const yearsValue = yearsExperience.trim() ? Number(yearsExperience.trim()) : null;
      const response = await api.startInterview(
        currentUser.uid,
        "resume",
        difficulty,
        resumeProfile,
        null,
        currentUser.displayName || "Candidate",
        Number.isFinite(yearsValue as number) ? yearsValue : null,
      );
      const sessionId = response.session_id;
      sessionStorage.setItem(`interview_type_${sessionId}`, "resume");
      if (getSkipPrecheck()) {
        navigate(`/interview/${sessionId}`);
        return;
      }
      setPreCheckSessionId(sessionId);
      setShowPreCheck(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start resume deep-dive";
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base px-5 py-8 pt-16">
      {showPreCheck && preCheckSessionId ? (
        <PreSessionCheckerWithBrowserCheck
          sessionId={preCheckSessionId}
          getAuthToken={() => currentUser?.getIdToken?.()}
          onAllPassed={() => {
            const id = preCheckSessionId;
            setShowPreCheck(false);
            setPreCheckSessionId(null);
            navigate(`/interview/${id}`);
          }}
          onCancel={() => {
            setShowPreCheck(false);
            setPreCheckSessionId(null);
          }}
        />
      ) : null}
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
          Mode // Resume_Deep_Dive
        </p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--border-subtle)] bg-raised p-6 md:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <FileSearch className="h-5 w-5 text-[var(--teal-1)]" />
            <h1 className="text-xl font-semibold text-[var(--cream-0)]">Resume deep-dive</h1>
          </div>
          <p className="mb-6 text-sm text-[var(--cream-2)]">
            We will anchor the interview in your resume and probe ownership, tradeoffs, and outcomes from your real work.
          </p>

          <div className="mb-5 rounded-xl border border-[var(--border-subtle)] bg-overlay p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)] mb-2">
              Active resume
            </p>
            {loadingResume ? (
              <p className="text-sm text-zinc-500">Checking Vault...</p>
            ) : resumeProfile ? (
              <div className="text-sm text-[var(--cream-1)]">
                <p>{resumeProfile.name || "Unnamed profile"}</p>
                <p className="text-[var(--cream-4)] mt-1">
                  {resumeProfile.work_experience?.length || 0} roles · {resumeProfile.projects?.length || 0} projects
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-red-400">No active resume found.</p>
                <button
                  type="button"
                  onClick={() => navigate("/vault")}
                  className="mt-2 btn-ghost text-xs"
                >
                  Open Vault
                </button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">
              Difficulty
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDifficulty(option.value)}
                  className={`rounded-lg border px-3 py-2 text-left ${
                    difficulty === option.value
                      ? "border-[var(--teal-1)] bg-[var(--teal-1)]/10"
                      : "border-[var(--border-subtle)]"
                  }`}
                >
                  <p className="text-sm text-[var(--cream-0)]">{option.label}</p>
                  <p className="text-[10px] text-[var(--cream-4)]">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-[var(--cream-4)]">
              Years of experience (optional)
            </label>
            <input
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-overlay px-3 py-2 text-sm text-[var(--cream-1)]"
              placeholder="e.g. 4"
            />
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={starting || !resumeProfile}
            className="btn-outline-cyan inline-flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-60"
          >
            {starting ? "Starting..." : "Start resume deep-dive"}
            <ChevronRight size={14} />
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default ResumeDeepDivePage;