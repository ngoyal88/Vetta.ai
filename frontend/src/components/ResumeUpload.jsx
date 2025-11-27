import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const ResumeUpload = ({ onParsed }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);

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

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setLoading(true);
      const data = await api.uploadResume(file);
      
      setParsedData(data.data);
      onParsed?.(data.data);
      toast.success('Resume parsed successfully!');
    } catch (err) {
      toast.error('Failed to parse resume');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">Upload Your Resume</h2>
      </div>

      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition">
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
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
          onClick={handleUpload}
          disabled={!file || loading}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
        >
          {loading ? '⏳ Parsing...' : '📤 Upload & Parse Resume'}
        </button>
      </div>

      {parsedData && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">Resume Parsed Successfully</h3>
          </div>
          <div className="text-sm text-gray-600">
            <p><strong>Name:</strong> {parsedData.name?.raw || 'N/A'}</p>
            <p><strong>Email:</strong> {parsedData.emails?.[0] || 'N/A'}</p>
            <p><strong>Skills:</strong> {parsedData.skills?.map(s => s.name).join(', ') || 'None'}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ResumeUpload;