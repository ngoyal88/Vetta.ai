import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Upload, Rocket, FileText, User, Shield } from 'lucide-react';
import { api } from '../services/api';
import useUserProfile from '../hooks/useUserProfile';

const Dashboard = () => {
  const { currentUser, logout } = useAuth();
  const { profile, loading } = useUserProfile();
  const navigate = useNavigate();
  
  const [parsedResume, setParsedResume] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [interviewType, setInterviewType] = useState('dsa');
  const [difficulty, setDifficulty] = useState('medium');
  const [customRole, setCustomRole] = useState('');
  const [file, setFile] = useState(null);

  const interviewTypes = [
    { value: 'dsa', label: 'DSA (Coding)', icon: '💻', desc: 'Data Structures & Algorithms' },
    { value: 'frontend', label: 'Frontend', icon: '🎨', desc: 'React, JavaScript, CSS' },
    { value: 'backend', label: 'Backend', icon: '⚙️', desc: 'APIs, Databases, Systems' },
    { value: 'core', label: 'Core CS', icon: '📚', desc: 'OS, Networks, DBMS' },
    { value: 'behavioral', label: 'Behavioral', icon: '🗣️', desc: 'Soft Skills, STAR Method' },
    { value: 'resume', label: 'Resume-Based', icon: '📄', desc: 'Based on Your Resume' },
    { value: 'custom', label: 'Custom Role', icon: '✨', desc: 'Any Specific Role' }
  ];

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
      toast.success('Resume parsed successfully!');
    } catch (err) {
      toast.error('Failed to parse resume');
      console.error(err);
    } finally {
      setUploadingResume(false);
    }
  };

  const handleStartInterview = () => {
    // Validate resume for resume-based interview
    if (interviewType === 'resume' && !parsedResume) {
      toast.error('Please upload your resume first for resume-based interview');
      return;
    }

    if (interviewType === 'custom' && !customRole.trim()) {
      toast.error('Please specify a custom role');
      return;
    }

    const sessionId = crypto.randomUUID();

    // Store config in localStorage
    localStorage.setItem('interviewConfig', JSON.stringify({
      sessionId,
      userId: currentUser.uid,
      interviewType,
      difficulty,
      customRole: interviewType === 'custom' ? customRole : null,
      resumeData: parsedResume
    }));

    navigate(`/interview/${sessionId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Welcome back, {profile?.name || 'User'}! 👋
            </h1>
            <p className="text-gray-600">Ready to ace your next interview?</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Logout
          </button>
        </motion.div>

        {/* Resume Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-8 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">Upload Your Resume</h2>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="resume-upload"
              />
              <label
                htmlFor="resume-upload"
                className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
              >
                {file ? file.name : 'Click to select a file'}
              </label>
              <p className="text-sm text-gray-500 mt-2">
                Supported: PDF, DOCX, TXT (Max 5MB)
              </p>
            </div>

            <button
              onClick={handleUploadResume}
              disabled={!file || uploadingResume}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
            >
              {uploadingResume ? '⏳ Parsing...' : '📤 Upload & Parse Resume'}
            </button>
          </div>

          {/* Resume Summary */}
          {parsedResume && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 p-6 bg-green-50 rounded-xl border border-green-200"
            >
              <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Resume Parsed Successfully</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong className="text-gray-700">Name:</strong>
                  <p className="text-gray-600">{parsedResume.name?.raw || 'N/A'}</p>
                </div>
                <div>
                  <strong className="text-gray-700">Email:</strong>
                  <p className="text-gray-600">{parsedResume.emails?.[0] || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <strong className="text-gray-700">Skills:</strong>
                  <p className="text-gray-600">{parsedResume.skills?.map(s => s.name).join(', ') || 'None detected'}</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Interview Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-800">Configure Your Interview</h2>
          </div>

          {/* Interview Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Interview Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {interviewTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setInterviewType(type.value)}
                  className={`p-4 rounded-xl border-2 transition text-left ${
                    interviewType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{type.icon}</div>
                  <div className="font-semibold text-gray-800">{type.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Custom Role</label>
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="e.g., Senior DevOps Engineer, ML Engineer..."
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </motion.div>
          )}

          {/* Difficulty Selection */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Difficulty Level</label>
            <div className="grid grid-cols-3 gap-3">
              {['easy', 'medium', 'hard'].map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`p-4 rounded-lg border-2 transition font-medium ${
                    difficulty === level
                      ? level === 'easy'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : level === 'medium'
                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartInterview}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition flex items-center justify-center gap-3"
          >
            <Rocket className="w-6 h-6" />
            Start Interview
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;