import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const ResumeUpload = ({ onParsed }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];

  const validateFile = (selectedFile) => {
    if (!selectedFile) return false;
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Only PDF, DOCX, and TXT files are supported');
      return false;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return false;
    }
    return true;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (validateFile(selectedFile)) setFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (validateFile(dropped)) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    try {
      setLoading(true);
      const res = await api.uploadResume(file);
      const parsed = res?.profile ?? res?.data;
      if (!parsed) throw new Error('Resume parser returned empty data');
      setParsedData(parsed);
      onParsed?.(parsed);
      toast.success('Resume parsed successfully');
    } catch (err) {
      toast.error('Failed to parse resume');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-raised border border-[var(--border-subtle)] p-6 max-w-xl"
    >
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-5 h-5 text-cyan-500" />
        <h2 className="text-lg font-semibold text-white">Upload resume</h2>
      </div>

      <div className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 bg-overlay ${
            isDragging
              ? 'border-cyan-500/60 bg-cyan-500/5'
              : 'border-[var(--border-subtle)] hover:border-zinc-600'
          }`}
        >
          {isDragging && (
            <span className="absolute inset-0 rounded-xl pointer-events-none border-2 border-dashed border-cyan-500/50 bg-cyan-500/5" />
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="resume-upload"
          />
          <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <label htmlFor="resume-upload" className="cursor-pointer block">
            <span className="text-zinc-400 hover:text-white font-medium transition-colors">
              {file ? file.name : 'Drop file or click to select'}
            </span>
          </label>
          <p className="text-xs text-zinc-600 mt-2">PDF, DOCX, TXT · Max 5MB</p>
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || loading}
          className="w-full h-10 btn-cyan flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Parsing...' : 'Upload & parse'}
        </button>
      </div>

      {parsedData && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">Parsed</span>
          </div>
          <div className="text-xs text-zinc-400 space-y-1">
            <p><span className="text-zinc-500">Name:</span> {parsedData.name?.raw || 'N/A'}</p>
            <p><span className="text-zinc-500">Email:</span> {parsedData.emails?.[0] || 'N/A'}</p>
            <p><span className="text-zinc-500">Skills:</span> {parsedData.skills?.map((s) => s.name).join(', ') || 'None'}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ResumeUpload;
