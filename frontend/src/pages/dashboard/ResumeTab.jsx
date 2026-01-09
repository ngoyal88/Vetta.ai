import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, FileText, Trash2, Upload } from 'lucide-react';

export default function ResumeTab({
  parsedResume,
  file,
  uploadingResume,
  handleFileChange,
  handleUploadResume,
  handleDeleteResume,
}) {
  // Backward-compatible: older stored values might be { data: {...}, meta: {...} }
  const resume = parsedResume?.data && typeof parsedResume.data === 'object' ? parsedResume.data : parsedResume;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 border border-cyan-600/20 rounded-2xl p-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl font-bold text-white">Resume Viewer</h2>
      </div>

      <div className="space-y-6">
        <div className="bg-black/40 border border-cyan-600/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Upload / Update Resume</h3>
            </div>
            {parsedResume && (
              <button
                onClick={handleDeleteResume}
                className="flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg hover:bg-red-600/30 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 items-center">
            <div className="border-2 border-dashed border-cyan-600/30 rounded-xl p-6 text-center hover:border-cyan-500/50 transition">
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-4" />
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="resume-upload"
              />
              <label htmlFor="resume-upload" className="cursor-pointer text-cyan-400 hover:text-cyan-300 font-medium">
                {file ? file.name : parsedResume ? 'Click to select a new file' : 'Click to select a file'}
              </label>
              <p className="text-sm text-gray-500 mt-2">Supported: PDF, DOCX, TXT (Max 5MB)</p>
            </div>

            <button
              onClick={handleUploadResume}
              disabled={!file || uploadingResume}
              className="w-full py-3 btn-cyan disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {uploadingResume ? '⏳ Parsing...' : parsedResume ? '🔄 Update Resume' : '📤 Upload Resume'}
            </button>
          </div>

          {resume && (
            <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-200 font-semibold">Current Resume</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-400">Name</div>
                  <div className="text-white">{resume?.name?.raw || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Email</div>
                  <div className="text-white">{resume?.emails?.[0] || 'N/A'}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-gray-400">Skills</div>
                  <div className="text-white">
                    {resume?.skills?.map((s) => s.name).join(', ') || 'None detected'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {!resume && (
          <div className="p-4 bg-black/40 border border-cyan-600/20 rounded-lg text-gray-300">
            No resume on file. Upload above to view details.
          </div>
        )}

        {resume && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-black/40 border border-cyan-600/20 rounded-lg">
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Contact</h3>
                <p className="text-gray-200">{resume?.name?.raw || 'Name not detected'}</p>
                <p className="text-gray-400">{resume?.emails?.[0] || 'Email not detected'}</p>
                <p className="text-gray-400">{resume?.phoneNumbers?.[0] || 'Phone not detected'}</p>
              </div>

              <div className="p-4 bg-black/40 border border-cyan-600/20 rounded-lg">
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Skills</h3>
                <p className="text-gray-200 break-words">
                  {resume?.skills?.length ? resume.skills.map((s) => s.name).join(', ') : 'No skills detected'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-black/40 border border-cyan-600/20 rounded-lg">
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Experience</h3>
                <div className="space-y-3 text-sm text-gray-200 max-h-64 overflow-auto custom-scrollbar">
                  {resume?.workExperience?.length ? (
                    resume.workExperience.map((exp, idx) => (
                      <div key={idx} className="border-b border-cyan-600/10 pb-2 last:border-0 last:pb-0">
                        <div className="font-semibold text-white">{exp.jobTitle || 'Role'}</div>
                        <div className="text-gray-400">
                          {exp.organization || 'Company'}{exp.dates ? ` • ${exp.dates}` : ''}
                        </div>
                        <div className="text-gray-500 mt-1 whitespace-pre-line">{exp.jobDescription || ''}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">No experience entries detected.</div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-black/40 border border-cyan-600/20 rounded-lg">
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Education</h3>
                <div className="space-y-3 text-sm text-gray-200">
                  {resume?.education?.length ? (
                    resume.education.map((edu, idx) => (
                      <div key={idx} className="border-b border-cyan-600/10 pb-2 last:border-0 last:pb-0">
                        <div className="font-semibold text-white">{edu.institution || 'Institution'}</div>
                        <div className="text-gray-400">
                          {edu.degree || 'Degree'}
                          {edu.dates ? ` • ${edu.dates}` : ''}
                        </div>
                        {edu.cgpa && <div className="text-gray-500 mt-1 whitespace-pre-line">{edu.cgpa}</div>}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">No education entries detected.</div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-black/40 border border-cyan-600/20 rounded-lg">
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">Projects</h3>
                <div className="space-y-3 text-sm text-gray-200 max-h-64 overflow-auto custom-scrollbar">
                  {resume?.projects?.length ? (
                    resume.projects.map((p, idx) => (
                      <div key={idx} className="border-b border-cyan-600/10 pb-2 last:border-0 last:pb-0">
                        <div className="font-semibold text-white">{p.name || 'Project'}</div>
                        {p.technologies?.length ? (
                          <div className="text-gray-400">{p.technologies.join(', ')}</div>
                        ) : null}
                        {p.description ? <div className="text-gray-500 mt-1 whitespace-pre-line">{p.description}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">No project entries detected.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
