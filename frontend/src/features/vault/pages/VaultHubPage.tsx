import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FolderTree, GitCompare } from 'lucide-react';
import toast from 'react-hot-toast';

import VaultPageHeader from '../components/VaultPageHeader';
import VaultUploadForm, { type UploadMode } from '../components/VaultUploadForm';
import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { getErrorMessage } from '../utils/vaultUtils';

export default function VaultHubPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { entries, meta, uploadResume } = useVaultLibraryContext();
  const [uploading, setUploading] = useState(false);

  const prefillResumeId = searchParams.get('resumeId');
  const initialMode: UploadMode = prefillResumeId ? 'version' : 'new';
  const hasResumes = entries.length > 0;

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

  return (
    <>
      <VaultPageHeader
        title="Store, version, and compare your resumes"
        subtitle="Upload versions for interviews, compare any two snapshots, and keep one active resume for mock sessions."
        resumeCount={resumeCount}
      />

      <VaultUploadForm
        entries={entries}
        initialMode={initialMode}
        initialResumeId={prefillResumeId}
        uploading={uploading}
        onUpload={handleUpload}
      />

      {!hasResumes ? (
        <p className="mt-4 text-center text-sm text-[var(--cream-3)]">
          Upload your first resume to get started.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/resume-vault/compare"
            className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6 transition hover:border-[var(--teal-2)]"
          >
            <GitCompare className="h-6 w-6 text-[var(--teal-1)]" />
            <h2 className="mt-3 text-lg font-medium text-[var(--cream-0)]">Compare</h2>
            <p className="mt-1 text-sm text-[var(--cream-3)]">Pick two versions — same resume or different ones.</p>
            <span className="mt-4 inline-block text-xs text-[var(--teal-1)] group-hover:text-[var(--cream-0)]">
              Open →
            </span>
          </Link>
          <Link
            to="/resume-vault/library"
            className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-6 transition hover:border-[var(--teal-2)]"
          >
            <FolderTree className="h-6 w-6 text-[var(--teal-1)]" />
            <h2 className="mt-3 text-lg font-medium text-[var(--cream-0)]">My library</h2>
            <p className="mt-1 text-sm text-[var(--cream-3)]">Browse all resumes like a file system.</p>
            <span className="mt-4 inline-block text-xs text-[var(--teal-1)] group-hover:text-[var(--cream-0)]">
              Open →
            </span>
          </Link>
        </div>
      )}
    </>
  );
}
