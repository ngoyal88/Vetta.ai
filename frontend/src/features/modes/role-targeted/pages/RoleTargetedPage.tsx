import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Clock, Code2, Brain, Mic, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useAuth } from 'shared/context/AuthContext';
import { api } from 'shared/services/api';
import type { ResumeProfile } from 'features/vault/types';
import { INTERVIEW_TYPES } from 'core/constants/interviewTypes';
import { PreSessionCheckerWithBrowserCheck } from 'features/interview/components/PreSessionChecker';
import { vaultApi } from 'features/vault/services/vaultApi';
import type { StartPanelProps } from 'features/dashboard/types/panels';

const DIFFICULTY_CONFIG: Record<string, { bars: number; color: string; label: string; desc: string }> = {
  easy: { bars: 1, color: 'text-emerald', label: 'Easy', desc: 'Warm up' },
  medium: { bars: 3, color: 'text-indigo', label: 'Medium', desc: 'Baseline' },
  hard: { bars: 5, color: 'text-red-400', label: 'Hard', desc: 'FAANG-level' },
};

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  dsa: Code2,
  behavioral: Brain,
  'system-design': Zap,
  resume: Clock,
  custom: Mic,
};

function StartSection({
  currentUser,
  interviewTypes,
  interviewType,
  setInterviewType,
  customRole,
  setCustomRole,
  difficulty,
  setDifficulty,
  yearsExperience,
  setYearsExperience,
  handleStartInterview,
}: StartPanelProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="max-w-xl">
      <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-4">Configure session</p>

      <div className="card p-5 space-y-6">
        {!currentUser?.emailVerified && (
          <div className="flex items-start gap-2 p-3 rounded-sm border border-yellow-500/20 bg-yellow-500/5">
            <div className="w-[5px] h-[5px] rounded-full bg-yellow-500 mt-1.5 shrink-0" />
            <p className="text-xs text-yellow-300/80">Email not verified - you can still proceed. Verify to protect account recovery.</p>
          </div>
        )}

        <div>
          <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Interview type</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {interviewTypes.map((type) => {
              const Icon = TYPE_ICONS[type.value] || Mic;
              const active = interviewType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setInterviewType(type.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-sm border text-left transition-all duration-100 ${
                    active
                      ? 'border-[var(--indigo-border)] bg-[var(--indigo-dim)] text-white shadow-indigo-sm'
                      : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon size={12} className={active ? 'text-indigo' : ''} />
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {interviewType === 'custom' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Custom role</label>
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="e.g. Senior DevOps Engineer"
                className="input-base w-full text-sm"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(DIFFICULTY_CONFIG).map(([level, cfg]) => {
              const active = difficulty === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`p-3 rounded-sm border text-left transition-all duration-100 ${
                    active
                      ? 'border-[var(--indigo-border)] bg-[var(--indigo-dim)] shadow-indigo-sm'
                      : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-end gap-[2px] h-4 mb-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`w-[3px] rounded-[1px] transition-colors ${
                          i <= cfg.bars ? (active ? 'bg-indigo' : 'bg-[var(--border-strong)]') : 'bg-[var(--border)]'
                        }`}
                        style={{ height: 4 + i * 2.5 }}
                      />
                    ))}
                  </div>
                  <div className={`text-xs font-semibold ${active ? 'text-white' : 'text-[var(--text-tertiary)]'}`}>{cfg.label}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{cfg.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Years of experience <span className="text-[var(--text-muted)]">(optional)</span>
          </label>
          <input
            type="number"
            min="0"
            max="40"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            placeholder="e.g. 3"
            className="input-base w-32 text-sm"
          />
        </div>

        <motion.button
          type="button"
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          whileTap={{ scale: 0.99 }}
          onClick={handleStartInterview}
          className="w-full h-10 rounded-sm border flex items-center justify-center gap-2 text-sm font-medium transition-all duration-150"
          style={{
            borderColor: hovered ? 'var(--indigo)' : 'var(--indigo-border)',
            background: hovered ? 'var(--indigo-dim)' : 'transparent',
            color: 'var(--text-primary)',
            boxShadow: hovered ? '0 0 0 1px var(--indigo), 0 0 20px var(--indigo-glow)' : 'none',
          }}
        >
          <Mic size={14} />
          Launch Session
          <ChevronRight size={14} />
        </motion.button>
      </div>

      <p className="mt-4 font-mono text-[10px] text-[var(--text-tertiary)]">{"// All sessions are recorded locally and scored in real time."}</p>
    </div>
  );
}

const RoleTargetedPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [parsedResume, setParsedResume] = useState<ResumeProfile | null>(null);
  const [interviewType, setInterviewType] = useState('dsa');
  const [difficulty, setDifficulty] = useState('medium');
  const [customRole, setCustomRole] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState<string | null>(null);

  const loadResume = useCallback(async () => {
    if (!currentUser) {
      setParsedResume(null);
      return;
    }
    try {
      const profile = await vaultApi.getActiveResumeProfile();
      setParsedResume(profile || null);
    } catch (err) {
      console.warn('Failed to load resume from Vault:', err);
      setParsedResume(null);
    }
  }, [currentUser]);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const handleStartInterview = async () => {
    if (!currentUser) {
      toast.error('Please sign in again');
      return;
    }
    if (interviewType === 'resume' && !parsedResume) {
      toast.error('Please upload your resume first');
      return;
    }
    if (interviewType === 'custom' && !customRole.trim()) {
      toast.error('Please specify a custom role');
      return;
    }

    try {
      const candidateName =
        (typeof parsedResume?.name === 'string' ? parsedResume.name : parsedResume?.name?.raw) ||
        currentUser?.displayName ||
        currentUser?.email?.split('@')[0] ||
        'Candidate';

      const response = await api.startInterview(
        currentUser.uid,
        interviewType,
        difficulty,
        parsedResume,
        interviewType === 'custom' ? customRole : null,
        candidateName,
        yearsExperience ? Number(yearsExperience) : null,
      );

      const sessionId = response.session_id;
      sessionStorage.setItem(`interview_type_${sessionId}`, interviewType);
      localStorage.setItem(
        'interviewConfig',
        JSON.stringify({
          sessionId,
          userId: currentUser.uid,
          interviewType,
          difficulty,
          customRole: interviewType === 'custom' ? customRole : null,
          resumeData: parsedResume,
          candidateName,
          yearsExperience: yearsExperience ? Number(yearsExperience) : null,
        }),
      );

      setPreCheckSessionId(sessionId);
      setShowPreCheck(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
      toast.error(`Failed to start interview: ${message}`);
    }
  };

  return (
    <div className="min-h-screen bg-base px-5 py-6 pt-16">
      {showPreCheck && preCheckSessionId && (
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
      )}

      <div className="mx-auto max-w-6xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Role Targeted</p>
        <StartSection
          currentUser={currentUser}
          interviewTypes={INTERVIEW_TYPES}
          interviewType={interviewType}
          setInterviewType={setInterviewType}
          customRole={customRole}
          setCustomRole={setCustomRole}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          yearsExperience={yearsExperience}
          setYearsExperience={setYearsExperience}
          handleStartInterview={handleStartInterview}
        />
      </div>
    </div>
  );
};

export default RoleTargetedPage;
