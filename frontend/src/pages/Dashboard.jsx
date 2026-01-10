import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { useAuth } from '../context/AuthContext';
import useUserProfile from '../hooks/useUserProfile';
import { api } from '../services/api';
import { db } from '../firebase';

import StartTab from './dashboard/StartTab';
import ResumeTab from './dashboard/ResumeTab';
import HistoryTab from './dashboard/HistoryTab';
import AccountTab from './dashboard/AccountTab';

const Dashboard = () => {
  const { currentUser, sendVerification, resetPassword, updateProfileInfo, deleteAccount, refreshUser } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();

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

    // 1) Prefer Firestore
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

    // 2) Fallback: local cache
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
      const data = res?.data;
      if (!data) throw new Error('Resume parser returned empty data');

      setParsedResume(data);
      localStorage.setItem(resumeStorageKey, JSON.stringify(data));

      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          resume: data,
          resumeUpdatedAt: serverTimestamp(),
        },
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

  const handleDeleteResume = useCallback(async () => {
    if (!currentUser) return;
    const confirmDelete = window.confirm('Delete your stored resume?');
    if (!confirmDelete) return;

    try {
      setParsedResume(null);
      setFile(null);
      localStorage.removeItem(resumeStorageKey);
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          resume: deleteField(),
          resumeUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success('Resume deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete resume');
    }
  }, [currentUser, resumeStorageKey]);

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
    async (id) => {
      if (!currentUser) return;
      const confirmDelete = window.confirm('Delete this interview? This cannot be undone.');
      if (!confirmDelete) return;

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
    [currentUser, fetchHistory]
  );

  useEffect(() => {
    loadResume();
  }, [loadResume]);

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

      localStorage.setItem('interviewConfig', JSON.stringify({
        sessionId,
        userId: currentUser.uid,
        interviewType,
        difficulty,
        customRole: interviewType === 'custom' ? customRole : null,
        resumeData: parsedResume,
        candidateName,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null
      }));

      navigate(`/interview/${sessionId}`);
    
    } catch (err) {
      console.error(err);
      toast.error('Failed to start interview: ' + err.message);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Welcome back, {profile?.name || 'User'}! 👋
            </h1>
            <p className="text-gray-400">Ready to ace your next interview?</p>
          </div>
          {/* Navbar already has logout; keep header clean */}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-cyan-600/20">
          <button
            onClick={() => setActiveTab('start')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'start'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Start New Interview
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'resume'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Resume Viewer
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'history'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Previous Interviews ({previousInterviews.length})
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'account'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Account & Profile
          </button>
        </div>

        {activeTab === 'start' && (
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
        )}

        {activeTab === 'resume' && (
          <ResumeTab
            parsedResume={parsedResume}
            file={file}
            uploadingResume={uploadingResume}
            handleFileChange={handleFileChange}
            handleUploadResume={handleUploadResume}
            handleDeleteResume={handleDeleteResume}
          />
        )}

        {activeTab === 'history' && (
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
        )}

        {activeTab === 'account' && (
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
        )}
      </div>
    </div>
  );
};

export default Dashboard;