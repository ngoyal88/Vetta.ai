import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Upload, Rocket, FileText, Clock, TrendingUp, CheckCircle, Trash2, ShieldCheck, RefreshCw, User2, Image, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import useUserProfile from '../hooks/useUserProfile';

const Dashboard = () => {
  const { currentUser, logout, sendVerification, resetPassword, updateProfileInfo, deleteAccount, refreshUser } = useAuth();
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
  const [activeTab, setActiveTab] = useState('start'); // 'start' or 'history'
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const interviewTypes = [
    { value: 'dsa', label: 'DSA (Coding)', icon: '💻', desc: 'Data Structures & Algorithms' },
    { value: 'frontend', label: 'Frontend', icon: '🎨', desc: 'React, JavaScript, CSS' },
    { value: 'backend', label: 'Backend', icon: '⚙️', desc: 'APIs, Databases, Systems' },
    { value: 'core', label: 'Core CS', icon: '📚', desc: 'OS, Networks, DBMS' },
    { value: 'behavioral', label: 'Behavioral', icon: '🗣️', desc: 'Soft Skills, STAR Method' },
    { value: 'resume', label: 'Resume-Based', icon: '📄', desc: 'Based on Your Resume' },
    { value: 'custom', label: 'Custom Role', icon: '✨', desc: 'Any Specific Role' }
  ];

  const formatDate = (value) => {
    if (!value) return 'Date unknown';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Date unknown';
    return parsed.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleToggleDetails = (id) => {
    setExpandedInterviewId((prev) => (prev === id ? null : id));
  };

  const handleDeleteInterview = async (id) => {
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
  };

  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoadingInterviews(true);
      const data = await api.getInterviewHistory();
      setPreviousInterviews(data.history || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load interview history');
    } finally {
      setLoadingInterviews(false);
    }
  }, [currentUser]);

  // Load previous interviews
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    setProfileName(currentUser?.displayName || '');
    setProfilePhoto(currentUser?.photoURL || '');
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Check if resume already exists in localStorage
  useEffect(() => {
    const savedResume = localStorage.getItem('resume_data');
    if (savedResume) {
      try {
        setParsedResume(JSON.parse(savedResume));
      } catch (err) {
        console.error('Failed to parse saved resume:', err);
      }
    }
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Only PDF, DOCX, and TXT files are supported');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleUploadResume = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setUploadingResume(true);
      const data = await api.uploadResume(file);
      setParsedResume(data.data);
      
      // Save to localStorage
      localStorage.setItem('resume_data', JSON.stringify(data.data));
      
      toast.success('Resume parsed successfully!');
    } catch (err) {
      toast.error('Failed to parse resume');
      console.error(err);
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResume = () => {
    if (window.confirm('Are you sure you want to delete your saved resume?')) {
      setParsedResume(null);
      localStorage.removeItem('resume_data');
      setFile(null);
      toast.success('Resume deleted');
    }
  };

  const handleStartInterview = async () => {
    if (interviewType === 'resume' && !parsedResume) {
      toast.error('Please upload your resume first for resume-based interview');
      return;
    }

    if (interviewType === 'custom' && !customRole.trim()) {
      toast.error('Please specify a custom role');
      return;
    }

    if (!currentUser?.emailVerified) {
      toast.error('Please verify your email before starting an interview');
      try {
        await sendVerification();
        toast.success('Verification email sent');
      } catch (err) {
        console.error(err);
      }
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
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition ${
              activeTab === 'history'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Previous Interviews ({previousInterviews.length})
          </button>
        </div>

        {/* Start Interview Tab */}
        {activeTab === 'start' && (
          <>
            {/* Resume Upload Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8 mb-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-2xl font-bold text-white">
                    {parsedResume ? 'Update Your Resume' : 'Upload Your Resume'}
                  </h2>
                </div>
                {parsedResume && (
                  <button
                    onClick={handleDeleteResume}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg hover:bg-red-600/30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>

              {/* Current Resume Summary */}
              {parsedResume && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-6 bg-cyan-500/10 border border-cyan-500/30 rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-semibold text-cyan-400">Current Resume</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong className="text-gray-300">Name:</strong>
                      <p className="text-gray-400">{parsedResume.name?.raw || 'N/A'}</p>
                    </div>
                    <div>
                      <strong className="text-gray-300">Email:</strong>
                      <p className="text-gray-400">{parsedResume.emails?.[0] || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <strong className="text-gray-300">Skills:</strong>
                      <p className="text-gray-400">{parsedResume.skills?.map(s => s.name).join(', ') || 'None detected'}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="space-y-4">
                <div className="border-2 border-dashed border-cyan-600/30 rounded-xl p-8 text-center hover:border-cyan-500/50 transition">
                  <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label
                    htmlFor="resume-upload"
                    className="cursor-pointer text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    {file ? file.name : parsedResume ? 'Click to select a new file' : 'Click to select a file'}
                  </label>
                  <p className="text-sm text-gray-500 mt-2">
                    Supported: PDF, DOCX, TXT (Max 5MB)
                  </p>
                </div>

                <button
                  onClick={handleUploadResume}
                  disabled={!file || uploadingResume}
                  className="w-full py-3 btn-cyan disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  {uploadingResume ? '⏳ Parsing...' : parsedResume ? '🔄 Update Resume' : '📤 Upload Resume'}
                </button>
              </div>
            </motion.div>

            {/* Interview Configuration */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <Rocket className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Configure Your Interview</h2>
              </div>

              {/* Interview Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-300 mb-3">Interview Type</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {interviewTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setInterviewType(type.value)}
                      className={`p-4 rounded-xl border-2 transition text-left ${
                        interviewType === type.value
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-cyan-600/20 hover:border-cyan-600/40'
                      }`}
                    >
                      <div className="text-3xl mb-2">{type.icon}</div>
                      <div className="font-semibold text-white">{type.label}</div>
                      <div className="text-xs text-gray-400 mt-1">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Role Input */}
              {interviewType === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6"
                >
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Custom Role</label>
                  <input
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="e.g., Senior DevOps Engineer, ML Engineer..."
                    className="w-full p-3 bg-black/50 border-2 border-cyan-600/20 rounded-lg focus:border-cyan-500 focus:outline-none text-white placeholder-gray-500"
                  />
                </motion.div>
              )}

              {/* Difficulty Selection */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-300 mb-3">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {['easy', 'medium', 'hard'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`p-4 rounded-lg border-2 transition font-medium ${
                        difficulty === level
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : 'border-cyan-600/20 hover:border-cyan-600/40 text-gray-400'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Years of Experience */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  placeholder="e.g., 3"
                  className="w-full p-3 bg-black/50 border-2 border-cyan-600/20 rounded-lg focus:border-cyan-500 focus:outline-none text-white placeholder-gray-500"
                />
              </div>

              {/* Start Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartInterview}
                className="w-full py-4 btn-cyan text-lg flex items-center justify-center gap-3"
              >
                <Rocket className="w-6 h-6" />
                Start Interview
              </motion.button>
            </motion.div>
          </>
        )}

        {/* Previous Interviews Tab */}
        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white">Previous Interviews</h2>
            </div>

            {loadingInterviews ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading interviews...</p>
              </div>
            ) : previousInterviews.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-gray-400 text-lg mb-4">No previous interviews yet</p>
                <button
                  onClick={() => setActiveTab('start')}
                  className="btn-outline-cyan"
                >
                  Start Your First Interview
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {previousInterviews.map((interview, index) => (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-6 bg-black/50 border border-cyan-600/20 rounded-xl hover:border-cyan-500/50 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white">
                            {(interview.custom_role || interview.interview_type || 'Interview').toUpperCase()}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            interview.difficulty === 'easy'
                              ? 'bg-green-500/20 text-green-400'
                              : interview.difficulty === 'hard'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {interview.difficulty || 'medium'}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            interview.status === 'completed'
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : interview.status === 'ended_early'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {interview.status === 'ended_early' ? 'Ended Early' : interview.status || 'in progress'}
                          </span>
                        </div>
                        
                        <p className="text-gray-400 text-sm mb-3">
                          {formatDate(interview.started_at || interview.created_at || interview.completed_at)}
                        </p>

                        {(interview.scores?.overall ?? interview.score) && (
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-cyan-400" />
                            <span className="text-cyan-400 font-medium">
                              Score: {(interview.scores?.overall ?? interview.score).toFixed ? (interview.scores?.overall ?? interview.score).toFixed(1) : interview.scores?.overall ?? interview.score}
                            </span>
                          </div>
                        )}

                        <div className="text-gray-400 text-xs mt-3">
                          <span className="mr-4">Questions: {interview.questions_answered ?? '—'}</span>
                          <span>Duration: {interview.duration_minutes !== undefined && interview.duration_minutes !== null ? `${interview.duration_minutes} min` : '—'}</span>
                        </div>

                        {interview.final_feedback?.feedback && (
                          <div className="mt-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg text-sm text-gray-200 max-h-32 overflow-hidden">
                            <div className="flex items-center gap-2 mb-1 text-cyan-300">
                              <FileText className="w-4 h-4" />
                              <span className="font-semibold text-xs uppercase tracking-wide">Feedback</span>
                            </div>
                            <p className="leading-relaxed whitespace-pre-line">{interview.final_feedback.feedback}</p>
                          </div>
                        )}

                        {interview.live_transcription?.length > 0 && (
                          <div className="mt-3 p-3 bg-black/40 border border-cyan-600/20 rounded-lg text-sm text-gray-300 max-h-28 overflow-hidden">
                            <div className="flex items-center gap-2 mb-1 text-cyan-300">
                              <Clock className="w-4 h-4" />
                              <span className="font-semibold text-xs uppercase tracking-wide">Transcript</span>
                            </div>
                            <div className="space-y-1">
                              {interview.live_transcription.slice(-3).map((entry, idx) => (
                                <p key={idx} className="text-xs text-gray-200">
                                  <span className="text-cyan-400 mr-1">{entry.speaker || 'speaker'}:</span>
                                  {entry.text}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleDetails(interview.id)}
                          className="px-4 py-2 btn-outline-cyan text-sm"
                        >
                          {expandedInterviewId === interview.id ? 'Hide Details' : 'View Details'}
                        </button>
                        <button
                          onClick={() => handleDeleteInterview(interview.id)}
                          disabled={deletingInterviewId === interview.id}
                          className="px-3 py-2 border border-red-500/40 text-red-300 rounded-lg text-xs hover:bg-red-500/10 disabled:opacity-60"
                        >
                          {deletingInterviewId === interview.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>

                    {expandedInterviewId === interview.id && (
                      <div className="mt-4 space-y-3 text-sm text-gray-200">
                        {Array.isArray(interview.responses) && interview.responses.length > 0 && (
                          <div className="p-3 bg-black/40 border border-cyan-600/20 rounded-lg">
                            <div className="font-semibold text-cyan-300 mb-2">Answers</div>
                            <div className="space-y-2 max-h-44 overflow-auto custom-scrollbar">
                              {interview.responses.map((resp, idx) => (
                                <div key={idx} className="text-xs text-gray-200">
                                  <span className="text-cyan-400 mr-1">Q{idx + 1}:</span>
                                  <span className="text-gray-300">{resp.question?.question?.question || resp.question?.question || resp.question || 'Question'}</span>
                                  <div className="mt-1 text-gray-400">A: {resp.response}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Array.isArray(interview.code_submissions) && interview.code_submissions.length > 0 && (
                          <div className="p-3 bg-black/40 border border-cyan-600/20 rounded-lg">
                            <div className="font-semibold text-cyan-300 mb-2">Code Submissions</div>
                            <div className="space-y-2 text-xs text-gray-300 max-h-36 overflow-auto custom-scrollbar">
                              {interview.code_submissions.map((sub, idx) => (
                                <div key={idx} className="border-b border-cyan-600/10 pb-2 last:border-0 last:pb-0">
                                  <div className="flex justify-between">
                                    <span className="text-cyan-400">{sub.language}</span>
                                    <span className="text-gray-500">{formatDate(sub.timestamp)}</span>
                                  </div>
                                  <div className="mt-1 text-gray-400 break-all">{sub.code?.slice(0, 200) || '—'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Account & Profile Tab */}
        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8 mt-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white">Account & Profile</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Display Name</label>
                  <div className="relative">
                    <User2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-600/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                      placeholder="Your name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Photo URL</label>
                  <div className="relative">
                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                    <input
                      type="url"
                      value={profilePhoto}
                      onChange={(e) => setProfilePhoto(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-black/50 border border-cyan-600/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <button
                  onClick={async () => {
                    try {
                      setSavingProfile(true);
                      await updateProfileInfo({ displayName: profileName || undefined, photoURL: profilePhoto || undefined });
                      await refreshUser();
                      toast.success('Profile updated');
                    } catch (err) {
                      console.error(err);
                      toast.error('Failed to update profile');
                    } finally {
                      setSavingProfile(false);
                    }
                  }}
                  disabled={savingProfile}
                  className="btn-cyan w-full"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await sendVerification();
                        toast.success('Verification email sent');
                      } catch (err) {
                        console.error(err);
                        toast.error('Failed to send verification');
                      }
                    }}
                    className="px-4 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg hover:bg-cyan-500/10"
                  >
                    Send Verification
                  </button>

                  <button
                    onClick={async () => {
                      if (!currentUser?.email) {
                        toast.error('No email on account');
                        return;
                      }
                      try {
                        await resetPassword(currentUser.email);
                        toast.success('Password reset email sent');
                      } catch (err) {
                        console.error(err);
                        toast.error('Failed to send reset email');
                      }
                    }}
                    className="px-4 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg hover:bg-cyan-500/10"
                  >
                    Reset Password
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-red-300 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold">Danger Zone</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">Delete your account and all interview history. This action cannot be undone.</p>
                  <button
                    onClick={async () => {
                      const confirmDelete = window.confirm('Delete your account and all interview data? This cannot be undone.');
                      if (!confirmDelete) return;
                      try {
                        setDeletingAccount(true);
                        await api.deleteAccountData();
                        await deleteAccount();
                        await logout();
                        toast.success('Account deleted');
                      } catch (err) {
                        console.error(err);
                        toast.error('Failed to delete account');
                      } finally {
                        setDeletingAccount(false);
                      }
                    }}
                    disabled={deletingAccount}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-60"
                  >
                    {deletingAccount ? 'Deleting...' : 'Delete Account'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;