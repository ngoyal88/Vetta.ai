import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FolderOpen, GitCompare } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';

import VaultHubHeader from '../components/hub/VaultHubHeader';
import VaultHubShortcutCard from '../components/hub/VaultHubShortcutCard';
import VaultUploadForm, { type UploadMode } from '../components/VaultUploadForm';
import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { getErrorMessage } from '../utils/vaultUtils';

const fadeUpTransition = {
  duration: 0.45,
  ease: 'easeOut' as const,
};

export default function VaultHubPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const { entries, meta, uploadResume } = useVaultLibraryContext();
  const [uploading, setUploading] = useState(false);

  const prefillResumeId = searchParams.get('resumeId');
  const initialMode: UploadMode = prefillResumeId ? 'version' : 'new';

  const resumeCount = useMemo(() => meta.resume_count ?? entries.length, [meta, entries]);

  const handleUpload = async (payload: {
    mode: UploadMode;
    file: File;
    name: string;
    tags: string;
    resumeId?: string;
    userNote?: string;
  }) => {
    try {
      setUploading(true);
      const result = await uploadResume({
        file: payload.file,
        name: payload.name,
        tags: payload.tags,
        resumeId: payload.resumeId,
        userNote: payload.userNote,
      });
      toast.success(payload.mode === 'new' ? 'Resume uploaded' : 'Version added');
      navigate(`/resume-vault/r/${result.entry.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'));
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const gridMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { ...fadeUpTransition, delay: 0.06 },
      };

  return (
    <div className="vault-hub-page">
      <div className="vault-hub-page__glow vault-hub-page__glow--primary" aria-hidden />
      <div className="vault-hub-page__glow vault-hub-page__glow--secondary" aria-hidden />

      <div className="app-container relative z-10">
        <VaultHubHeader resumeCount={resumeCount} />

        <motion.div
          {...gridMotion}
          className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-gutter"
        >
          <div className="lg:col-span-8">
            <VaultUploadForm
              entries={entries}
              initialMode={initialMode}
              initialResumeId={prefillResumeId}
              uploading={uploading}
              onUpload={handleUpload}
            />
          </div>

          <div className="flex flex-col gap-6 lg:col-span-4 lg:gap-gutter">
            <VaultHubShortcutCard
              to="/resume-vault/compare"
              icon={GitCompare}
              title="Compare Versions"
              description="AI-powered side-by-side analysis to identify missing skills or impact gaps between tailored variants."
              accent="secondary"
            />
            <VaultHubShortcutCard
              to="/resume-vault/library"
              icon={FolderOpen}
              title="My Library"
              description="Folder-style management for all your uploaded documents, cover letters, and master career data."
              accent="primary"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
