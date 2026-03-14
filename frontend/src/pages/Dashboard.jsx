import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Home, Mic, FileText, Clock, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import useUserProfile from '../hooks/useUserProfile';
import { api } from '../services/api';
import { db } from '../firebase';

import StartTab from './dashboard/StartTab';
import ResumeTab from './dashboard/ResumeTab';
import HistoryTab from './dashboard/HistoryTab';
import AccountTab from './dashboard/AccountTab';
import { PreSessionCheckerWithBrowserCheck } from '../components/PreSessionChecker';

const SIDEBAR_ITEMS = [
  { id: 'start', label: 'Start', icon: Mic },
  { id: 'resume', label: 'Resume', icon: FileText },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'account', label: 'Account', icon: User },
];

function useLiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const Dashboard = () => {
  const { currentUser, sendVerification, resetPassword, updateProfileInfo, deleteAccount, refreshUser } = useAuth();
  const { confirmDialog } = useConfirmDialog();
  const { profile, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();
  const clock = useLiveClock();

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [parsedResume, setParsedResume] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [interviewType, setInterviewType] = useState('dsa');
  const [difficulty, setDifficulty] = useState('medium');
  const [customRole, setCustomRole] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [file, setFile] = useState(null);
  const [previousInterviews, setPreviousInterviews] = useState([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [expandedInterviewId, setExpandedInterviewId] = useState(null);
  const [deletingInterviewId, setDeletingInterviewId] = useState(null);
  const [activeTab, setActiveTab] = useState('start');
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccountState, setDeletingAccountState] = useState(false);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [preCheckSessionId, setPreCheckSessionId] = useState(null);

  const resumeStorageKey = useMemo(
    () => (currentUser ? `resume_data_${currentUser.uid}` : 'resume_data'),
    [currentUser]
  );

  const interviewTypes = useMemo(
    () => [
      { value: 'dsa', label: 'DSA (Coding)', icon: '💻', desc: 'Data Structures & Algorithms' },
      { value: 'frontend', label: 'Frontend', icon: '🎨', desc: 'React, JavaScript, CSS' },
      { value: 'backend', label: 'Backend', icon: '⚙️', desc: 'APIs, Databases, Systems' },
      { value: 'core', label: 'Core CS', icon: '📚', desc: 'OS, Networks, DBMS' },
      { value: 'behavioral', label: 'Behavioral', icon: '🗣️', desc: 'Soft Skills, STAR Method' },
      { value: 'resume', label: 'Resume-Based', icon: '📄', desc: 'Based on Your Resume' },
      { value: 'custom', label: 'Custom Role', icon: '✨', desc: 'Any Specific Role' },
    ],
    []
  );

  const formatDate = (value) => {
    if (!value) return 'Date unknown';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Date unknown';
    return parsed.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleToggleDetails = (id) => {
    setExpandedInterviewId((prev) => (prev === id ? null : id));
  };

  const handleFileChange = (e) => {
    const selected = e.target?.files?.[0] || null;
    setFile(selected);
  };

  const loadResume = useCallback(async () => {
    if (!currentUser) {
      setParsedResume(null);
      return;
    }
    try {
      const ref = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data?.resume) {
          const normalized = data.resume?.data && typeof data.resume.data === 'object' ? data.resume.data : data.resume;
          setParsedResume(normalized);
          localStorage.setItem(resumeStorageKey, JSON.stringify(normalized));
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to load resume from Firestore:', err);
    }
    try {
      const cached = localStorage.getItem(resumeStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const normalized = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        setParsedResume(normalized);
      } else {
        setParsedResume(null);
      }
    } catch {
      setParsedResume(null);
    }
  }, [currentUser, resumeStorageKey]);

  const handleUploadResume = useCallback(async () => {
    if (!currentUser) {
      toast.error('Please sign in again');
      return;
    }
    if (!file) {
      toast.error('Please choose a file first');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large (max 5MB)');
      return;
    }
    try {
      setUploadingResume(true);
      const res = await api.uploadResume(file);
      const parsed = res?.profile ?? res?.data;
      if (!parsed) throw new Error('Resume parser returned empty data');
      setParsedResume(parsed);
      localStorage.setItem(resumeStorageKey, JSON.stringify(parsed));
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { resume: parsed, resumeUpdatedAt: serverTimestamp() },
        { merge: true }
      );
      toast.success('Resume uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload resume');
    } finally {
      setUploadingResume(false);
    }
  }, [currentUser, file, resumeStorageKey]);

  const handleDeleteResume = useCallback(() => {
    if (!currentUser) return;
    confirmDialog({
      title: 'Delete resume',
      message: 'Delete your stored resume?',
      destructive: true,
      onConfirm: async () => {
        try {
          setParsedResume(null);
          setFile(null);
          localStorage.removeItem(resumeStorageKey);
          await setDoc(
            doc(db, 'users', currentUser.uid),
            { resume: deleteField(), resumeUpdatedAt: serverTimestamp() },
            { merge: true }
          );
          toast.success('Resume deleted');
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete resume');
        }
      },
    });
  }, [currentUser, resumeStorageKey, confirmDialog]);

  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoadingInterviews(true);
      const data = await api.getInterviewHistory();
      setPreviousInterviews(Array.isArray(data?.history) ? data.history : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load interview history');
    } finally {
      setLoadingInterviews(false);
    }
  }, [currentUser]);

  const handleDeleteInterview = useCallback(
    (id) => {
      if (!currentUser) return;
      confirmDialog({
        title: 'Delete interview',
        message: 'Delete this interview? This cannot be undone.',
        destructive: true,
        onConfirm: async () => {
          try {
            setDeletingInterviewId(id);
            await api.deleteInterview(id);
            toast.success('Interview deleted');
            await fetchHistory();
          } catch (err) {
            console.error(err);
            toast.error('Failed to delete interview');
          } finally {
            setDeletingInterviewId(null);
          }
        },
      });
    },
    [currentUser, fetchHistory, confirmDialog]
  );

  useEffect(() => loadResume(), [loadResume]);
  useEffect(() => {
    if (!currentUser) return;
    fetchHistory();
  }, [currentUser, fetchHistory]);
  useEffect(() => {
    if (activeTab !== 'history') return;
    fetchHistory();
  }, [activeTab, fetchHistory]);
  useEffect(() => {
    setProfileName(profile?.name || currentUser?.displayName || '');
    setProfilePhoto(currentUser?.photoURL || '');
  }, [profile?.name, currentUser]);

  const handleStartInterview = async () => {
    if (interviewType === 'resume' && !parsedResume) {
      toast.error('Please upload your resume first for resume-based interview');
      return;
    }
    if (interviewType === 'custom' && !customRole.trim()) {
      toast.error('Please specify a custom role');
      return;
    }
    try {
      const candidateName = parsedResume?.name?.raw || profile?.name || currentUser?.displayName || 'Candidate';
      const response = await api.startInterview(
        currentUser.uid,
        interviewType,
        difficulty,
        parsedResume,
        interviewType === 'custom' ? customRole : null,
        candidateName,
        yearsExperience ? Number(yearsExperience) : null
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
        })
      );
      setPreCheckSessionId(sessionId);
      setShowPreCheck(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to start interview: ' + err.message);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center pt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500 border-t-transparent" />
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-base pt-12 flex">
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
      {/* Sidebar: 64px collapsed, 240px expanded */}
      <aside
        className="fixed left-0 top-12 bottom-0 z-30 flex flex-col border-r border-[var(--border-subtle)] bg-raised transition-[width] duration-300 ease-out overflow-hidden"
        style={{ width: sidebarExpanded ? 240 : 64 }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <Link
          to="/"
          className="flex items-center gap-3 h-12 px-3 text-zinc-400 hover:text-white hover:bg-overlay transition-colors shrink-0"
        >
          <Home className="w-5 h-5 shrink-0" />
          {sidebarExpanded && <span className="text-sm whitespace-nowrap">Home</span>}
        </Link>
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-3 h-12 px-3 transition-colors shrink-0 ${
              activeTab === item.id ? 'text-cyan-400 bg-overlay' : 'text-zinc-400 hover:text-white hover:bg-overlay'
            }`}
            title={item.label}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {sidebarExpanded && <span className="text-sm whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </aside>

      <main className="flex-1 ml-16 min-h-0 flex flex-col">
        {/* Top bar: greeting + clock */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-[var(--border-subtle)] shrink-0">
          <p className="text-sm text-zinc-400">
            {getGreeting()}, <span className="text-white font-medium">{displayName}</span>
          </p>
          <p className="text-sm font-mono text-zinc-500 tabular-nums" aria-live="polite">
            {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'start' && (
              <motion.div
                key="start"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <StartTab
                  currentUser={currentUser}
                  interviewTypes={interviewTypes}
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
              </motion.div>
            )}
            {activeTab === 'resume' && (
              <motion.div
                key="resume"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ResumeTab
                  parsedResume={parsedResume}
                  file={file}
                  uploadingResume={uploadingResume}
                  handleFileChange={handleFileChange}
                  handleUploadResume={handleUploadResume}
                  handleDeleteResume={handleDeleteResume}
                />
              </motion.div>
            )}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <HistoryTab
                  loadingInterviews={loadingInterviews}
                  previousInterviews={previousInterviews}
                  expandedInterviewId={expandedInterviewId}
                  deletingInterviewId={deletingInterviewId}
                  fetchHistory={fetchHistory}
                  handleToggleDetails={handleToggleDetails}
                  handleDeleteInterview={handleDeleteInterview}
                  formatDate={formatDate}
                  setActiveTab={setActiveTab}
                />
              </motion.div>
            )}
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <AccountTab
                  currentUser={currentUser}
                  profileName={profileName}
                  setProfileName={setProfileName}
                  profilePhoto={profilePhoto}
                  setProfilePhoto={setProfilePhoto}
                  savingProfile={savingProfile}
                  setSavingProfile={setSavingProfile}
                  sendVerification={sendVerification}
                  resetPassword={resetPassword}
                  updateProfileInfo={updateProfileInfo}
                  refreshUser={refreshUser}
                  deletingAccountState={deletingAccountState}
                  setDeletingAccountState={setDeletingAccountState}
                  api={api}
                  deleteAccount={deleteAccount}
                  navigate={navigate}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
