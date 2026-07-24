import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FolderOpen, Wand2 } from 'lucide-react';

import {
  VaultHubActivityPanel,
  VaultHubCompareCard,
  VaultHubHeader,
  VaultHubPrimaryCard,
  VaultHubQuickUploadCard,
} from 'features/vault/components/hub';
import { VAULT_HUB_COPY } from 'features/vault/constants/hubContent';
import { useVaultLibraryContext } from 'features/vault/context/VaultLibraryContext';
import { useRecentBuilderDraft } from 'features/resume-builder/queries/useRecentBuilderDraft';
import AppIndeterminateBar from 'shared/components/AppIndeterminateBar';

const BUILDER_ENABLED = import.meta.env.VITE_RESUME_BUILDER_ENABLED === 'true';

export default function VaultHubPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { entries, meta, isFetching, uploadResume } = useVaultLibraryContext();
  const { recentDraft } = useRecentBuilderDraft();
  const [uploading, setUploading] = useState(false);

  const resumeCount = meta.resume_count ?? entries.length;

  const handleQuickUpload = async (file: File, name: string) => {
    setUploading(true);
    try {
      const result = await uploadResume({
        file,
        name,
        tags: '',
      });
      toast.success('Resume uploaded');
      navigate(`/resume-vault/r/${result.entry.id}`);
    } finally {
      setUploading(false);
    }
  };

  // Honor ?resumeId= for version upload deep-links — scroll user to library or show toast
  const prefillResumeId = searchParams.get('resumeId');
  React.useEffect(() => {
    if (prefillResumeId) {
      navigate(`/resume-vault/library?resumeId=${encodeURIComponent(prefillResumeId)}`, { replace: true });
    }
  }, [navigate, prefillResumeId]);

  return (
    <div className="vault-hub-page">
      <AppIndeterminateBar active={isFetching} />
      <VaultHubHeader resumeCount={resumeCount} />

      <div className="vault-hub-primary-grid">
        {BUILDER_ENABLED ? (
          <VaultHubPrimaryCard
            to="/resume-vault/builder"
            icon={Wand2}
            title={VAULT_HUB_COPY.builderCard.title}
            description={VAULT_HUB_COPY.builderCard.description}
            cta={VAULT_HUB_COPY.builderCard.cta}
            variant="primary"
          />
        ) : null}
        <VaultHubPrimaryCard
          to="/resume-vault/library"
          icon={FolderOpen}
          title={VAULT_HUB_COPY.libraryCard.title}
          description={VAULT_HUB_COPY.libraryCard.description}
          cta={VAULT_HUB_COPY.libraryCard.cta}
          variant={BUILDER_ENABLED ? 'secondary' : 'primary'}
        />
      </div>

      <div className="vault-hub-secondary-grid">
        <VaultHubActivityPanel
          entries={entries}
          activeResumeId={meta.active_resume_id ?? null}
          recentDraft={recentDraft}
          showDrafts={BUILDER_ENABLED}
        />
        <VaultHubQuickUploadCard uploading={uploading} onUpload={handleQuickUpload} />
        <VaultHubCompareCard />
      </div>
    </div>
  );
}
