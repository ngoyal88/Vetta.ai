import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { VaultHubHeader, VaultHubQuickLink, VaultHubUploadForm } from 'features/vault/components/hub';
import { VAULT_HUB_QUICK_LINKS } from 'features/vault/constants/hubQuickLinks';
import { useVaultLibraryContext } from 'features/vault/context/VaultLibraryContext';
import type { VaultUploadMode, VaultUploadPayload } from 'features/vault/types/upload';

export default function VaultHubPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { entries, meta, uploadResume } = useVaultLibraryContext();
  const [uploading, setUploading] = useState(false);

  const prefillResumeId = searchParams.get('resumeId');
  const initialUploadMode: VaultUploadMode = prefillResumeId ? 'version' : 'new';
  const resumeCount = meta.resume_count ?? entries.length;

  const handleUpload = async (payload: VaultUploadPayload) => {
    setUploading(true);
    try {
      const result = await uploadResume({
        file: payload.file,
        name: payload.name,
        tags: payload.tags,
        resumeId: payload.resumeId,
        userNote: payload.userNote,
      });
      toast.success(payload.mode === 'new' ? 'Resume uploaded' : 'Version added');
      navigate(`/resume-vault/r/${result.entry.id}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app-container">
        <VaultHubHeader resumeCount={resumeCount} />

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-gutter">
          <div className="lg:col-span-8">
            <VaultHubUploadForm
              entries={entries}
              initialMode={initialUploadMode}
              initialResumeId={prefillResumeId}
              uploading={uploading}
              onUpload={handleUpload}
            />
          </div>

          <div className="flex flex-col gap-6 lg:col-span-4 lg:gap-gutter">
            {VAULT_HUB_QUICK_LINKS.map((link) => (
              <VaultHubQuickLink key={link.to} {...link} />
            ))}
          </div>
        </div>
    </div>
  );
}
