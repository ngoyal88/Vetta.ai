import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BriefcaseBusiness, ChevronRight, FileText, Mic, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useAuth } from 'shared/context/AuthContext';
import { api } from 'shared/services/api';
import type { ResumeProfile } from 'features/vault/types';
import { PreSessionCheckerWithBrowserCheck } from 'features/interview/components/PreSessionChecker';
import { vaultApi } from 'features/vault/services/vaultApi';

const COMPANY_OPTIONS = [
  'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Uber', 'Airbnb',
  'Stripe', 'Atlassian', 'Salesforce', 'Adobe', 'Oracle', 'IBM', 'Nvidia',
  'Tesla', 'OpenAI', 'Anthropic', 'Databricks', 'Snowflake', 'Palantir',
  'Bloomberg', 'Goldman Sachs', 'JPMorgan Chase', 'Walmart Global Tech',
  'Flipkart', 'PhonePe', 'Razorpay', 'Zomato', 'Swiggy', 'CRED', 'Meesho',
  'Zoho', 'Freshworks', 'TCS', 'Infosys', 'Wipro', 'Accenture', 'Deloitte',
];

const ROLE_OPTIONS = [
  'Software Engineer', 'Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer',
  'Mobile Engineer', 'Android Engineer', 'iOS Engineer', 'DevOps Engineer',
  'Site Reliability Engineer', 'Cloud Engineer', 'Platform Engineer', 'Data Engineer',
  'Machine Learning Engineer', 'AI Engineer', 'Data Scientist', 'Data Analyst',
  'Product Engineer', 'QA Engineer', 'Security Engineer', 'System Design / Architecture',
  'Engineering Manager', 'Product Manager', 'Technical Program Manager', 'Business Analyst',
];

const FOCUS_OPTIONS = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'technical', label: 'Technical' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'system_design', label: 'System Design' },
  { value: 'dsa', label: 'DSA / Coding' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy', desc: 'Warm up' },
  { value: 'medium', label: 'Medium', desc: 'Baseline' },
  { value: 'hard', label: 'Hard', desc: 'FAANG-level' },
];

function filterOptions(options: string[], query: string) {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return options.slice(0, 10);
  return options.filter((item) => item.toLowerCase().includes(cleaned)).slice(0, 10);
}

const RoleTargetedPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [parsedResume, setParsedResume] = useState<ResumeProfile | null>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [roleQuery, setRoleQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [interviewFocus, setInterviewFocus] = useState('mixed');
  const [difficulty, setDifficulty] = useState('medium');
  const [yearsExperience, setYearsExperience] = useState('');
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const companyValue = selectedCompany || companyQuery.trim();
  const roleValue = selectedRole || roleQuery.trim();
  const companyMatches = filterOptions(COMPANY_OPTIONS, companyQuery);
  const roleMatches = filterOptions(ROLE_OPTIONS, roleQuery);

  const loadResume = useCallback(async () => {
    if (!currentUser) {
      setParsedResume(null);
      return;
    }
    try {
      const profile = await vaultApi.getActiveResumeProfile();
      setParsedResume(profile || null);
    } catch {
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
    if (!roleValue) {
      toast.error('Select or enter a target role');
      return;
    }
    const jdText = jobDescription.trim();
    if (!parsedResume && !jdText) {
      toast('No resume or job description — the session will use your role and company only.');
    } else if (!parsedResume) {
      toast('No active resume — we will lean on your role, company, and any job description.');
    }

    try {
      const candidateName =
        (typeof parsedResume?.name === 'string' ? parsedResume.name : parsedResume?.name?.raw) ||
        currentUser.displayName ||
        currentUser.email?.split('@')[0] ||
        'Candidate';

      const response = await api.startInterview(
        currentUser.uid,
        'role_targeted',
        difficulty,
        parsedResume,
        roleValue,
        candidateName,
        yearsExperience ? Number(yearsExperience) : null,
        {
          targetCompany: companyValue || null,
          targetRole: roleValue,
          jobDescription: jdText || null,
          interviewFocus: interviewFocus,
        },
      );

      const sessionId = response.session_id;
      sessionStorage.setItem(`interview_type_${sessionId}`, 'role_targeted');
      localStorage.setItem(
        'interviewConfig',
        JSON.stringify({
          sessionId,
          userId: currentUser.uid,
          interviewType: 'role_targeted',
          difficulty,
          customRole: roleValue,
          resumeData: parsedResume,
          candidateName,
          yearsExperience: yearsExperience ? Number(yearsExperience) : null,
          targetCompany: companyValue || null,
          targetRole: roleValue,
          jobDescription: jdText || null,
          interviewFocus,
        }),
      );

      setPreCheckSessionId(sessionId);
      setShowPreCheck(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="card p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--bg-2)]">
                <BriefcaseBusiness size={16} className="text-[var(--teal-1)]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--cream-0)]">Prepare for a target role</h1>
                <p className="text-xs text-[var(--cream-3)]">Company and role shape the loop; paste a JD when you have one.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs text-[var(--cream-3)]">
                  Company
                  <div className="mt-1 flex items-center gap-2 rounded-sm border border-[var(--border-strong)] bg-[var(--bg-1)] px-3">
                    <Search size={13} className="text-[var(--cream-4)]" />
                    <input
                      value={companyQuery}
                      onChange={(e) => {
                        setCompanyQuery(e.target.value);
                        setSelectedCompany('');
                      }}
                      placeholder="Search or type custom company"
                      className="h-9 w-full bg-transparent text-sm text-[var(--cream-0)] outline-none"
                    />
                  </div>
                  <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                    {companyMatches.map((company) => (
                      <button
                        key={company}
                        type="button"
                        onClick={() => {
                          setSelectedCompany(company);
                          setCompanyQuery(company);
                        }}
                        className={`rounded-sm border px-2 py-1 text-[11px] ${
                          companyValue === company
                            ? 'border-[var(--teal-2)] bg-[var(--emerald-dim)] text-[var(--cream-0)]'
                            : 'border-[var(--border)] text-[var(--cream-3)] hover:text-[var(--cream-1)]'
                        }`}
                      >
                        {company}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="block text-xs text-[var(--cream-3)]">
                  Target role
                  <div className="mt-1 flex items-center gap-2 rounded-sm border border-[var(--border-strong)] bg-[var(--bg-1)] px-3">
                    <Search size={13} className="text-[var(--cream-4)]" />
                    <input
                      value={roleQuery}
                      onChange={(e) => {
                        setRoleQuery(e.target.value);
                        setSelectedRole('');
                      }}
                      placeholder="Search or type custom role"
                      className="h-9 w-full bg-transparent text-sm text-[var(--cream-0)] outline-none"
                    />
                  </div>
                  <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                    {roleMatches.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role);
                          setRoleQuery(role);
                        }}
                        className={`rounded-sm border px-2 py-1 text-[11px] ${
                          roleValue === role
                            ? 'border-[var(--teal-2)] bg-[var(--emerald-dim)] text-[var(--cream-0)]'
                            : 'border-[var(--border)] text-[var(--cream-3)] hover:text-[var(--cream-1)]'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <label className="block text-xs text-[var(--cream-3)]">
                Job description <span className="text-[var(--cream-4)]">(optional)</span>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Optional: paste a posting, responsibilities, or recruiter notes for tighter alignment..."
                  className="mt-1 min-h-44 w-full resize-y rounded-sm border border-[var(--border-strong)] bg-[var(--bg-1)] px-3 py-3 text-sm text-[var(--cream-0)] outline-none focus:border-[var(--teal-2)]"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-3)]">Interview focus</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {FOCUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setInterviewFocus(option.value)}
                        className={`rounded-sm border px-2 py-2 text-xs ${
                          interviewFocus === option.value
                            ? 'border-[var(--teal-2)] bg-[var(--emerald-dim)] text-[var(--cream-0)]'
                            : 'border-[var(--border)] text-[var(--cream-3)] hover:text-[var(--cream-1)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-xs text-[var(--cream-3)]">
                  Years of experience
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="e.g. 3"
                    className="mt-1 h-10 w-full rounded-sm border border-[var(--border-strong)] bg-[var(--bg-1)] px-3 text-sm text-[var(--cream-0)] outline-none"
                  />
                </label>
              </div>

              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-3)]">Difficulty</p>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDifficulty(option.value)}
                      className={`rounded-sm border p-3 text-left ${
                        difficulty === option.value
                          ? 'border-[var(--teal-2)] bg-[var(--emerald-dim)] text-[var(--cream-0)]'
                          : 'border-[var(--border)] text-[var(--cream-3)] hover:text-[var(--cream-1)]'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[10px] text-[var(--cream-4)]">{option.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                type="button"
                onHoverStart={() => setHovered(true)}
                onHoverEnd={() => setHovered(false)}
                whileTap={{ scale: 0.99 }}
                onClick={handleStartInterview}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-sm border text-sm font-medium transition-all duration-150"
                style={{
                  borderColor: hovered ? 'var(--teal-1)' : 'var(--teal-2)',
                  background: hovered ? 'var(--emerald-dim)' : 'transparent',
                  color: 'var(--cream-0)',
                }}
              >
                <Mic size={14} />
                Launch Role Targeted Session
                <ChevronRight size={14} />
              </motion.button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText size={14} className="text-[var(--teal-1)]" />
                <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--cream-3)]">Resume context</p>
              </div>
              {parsedResume ? (
                <p className="text-sm text-[var(--cream-2)]">
                  Active Resume Vault profile loaded. The interviewer will use it with your target role.
                </p>
              ) : (
                <p className="text-sm text-yellow-300/80">
                  No active resume found. You can still start from company, role, and focus—or add a JD for extra context.
                </p>
              )}
            </div>
            <div className="card p-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--cream-3)]">Session target</p>
              <div className="space-y-2 text-sm text-[var(--cream-2)]">
                <p>Company: <span className="text-[var(--cream-0)]">{companyValue || 'Custom / unspecified'}</span></p>
                <p>Role: <span className="text-[var(--cream-0)]">{roleValue || 'Not selected'}</span></p>
                <p>Focus: <span className="text-[var(--cream-0)]">{interviewFocus.replace('_', ' ')}</span></p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RoleTargetedPage;
