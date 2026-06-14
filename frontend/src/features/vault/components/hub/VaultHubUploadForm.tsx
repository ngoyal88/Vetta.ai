import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';

import type { VaultEntry } from 'features/vault/types';
import type { VaultUploadMode, VaultUploadPayload } from 'features/vault/types/upload';
import { getErrorMessage, validateResumeFile } from 'features/vault/utils/vaultUtils';

export type { VaultUploadMode, VaultUploadPayload };

type VaultHubUploadFormProps = {
  entries: VaultEntry[];
  initialMode?: VaultUploadMode;
  initialResumeId?: string | null;
  uploading: boolean;
  onUpload: (payload: VaultUploadPayload) => Promise<void>;
};

function buildActiveTabClass(isActive: boolean): string {
  return ['vault-hub-tab', isActive ? 'vault-hub-tab--active' : ''].filter(Boolean).join(' ');
}

export default function VaultHubUploadForm({
  entries,
  initialMode = 'new',
  initialResumeId = null,
  uploading,
  onUpload,
}: VaultHubUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<VaultUploadMode>(initialMode);
  const [resumeName, setResumeName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [baseResumeId, setBaseResumeId] = useState(initialResumeId || entries[0]?.id || '');
  const [versionNotes, setVersionNotes] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  React.useEffect(() => {
    setUploadMode(initialMode);
  }, [initialMode]);

  React.useEffect(() => {
    if (initialResumeId) {
      setBaseResumeId(initialResumeId);
    }
  }, [initialResumeId]);

  const baseResume = entries.find((entry) => entry.id === baseResumeId);
  const canAddVersion = entries.length > 0;

  const selectFile = useCallback((file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateResumeFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSelectedFile(file);
  }, []);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateResumeFile(selectedFile);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!selectedFile) return;

    if (uploadMode === 'new' && !resumeName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (uploadMode === 'version' && !baseResumeId) {
      toast.error('Select a resume');
      return;
    }

    try {
      await onUpload({
        mode: uploadMode,
        file: selectedFile,
        name: uploadMode === 'new' ? resumeName.trim() : baseResume?.name || resumeName.trim(),
        tags: uploadMode === 'new' ? tagsInput : (baseResume?.tags || []).join(', '),
        resumeId: uploadMode === 'version' ? baseResumeId : undefined,
        userNote: uploadMode === 'version' ? versionNotes : undefined,
      });

      setSelectedFile(null);
      setResumeName('');
      setTagsInput('');
      setVersionNotes('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="glass-panel flex h-full min-h-[32rem] flex-col overflow-hidden rounded-2xl"
    >
      <div
        className="flex border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--color-surface-container-lowest)_80%,transparent)]"
        role="tablist"
        aria-label="Upload mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={uploadMode === 'new'}
          onClick={() => setUploadMode('new')}
          className={buildActiveTabClass(uploadMode === 'new')}
        >
          New Resume
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={uploadMode === 'version'}
          onClick={() => canAddVersion && setUploadMode('version')}
          disabled={!canAddVersion}
          title={canAddVersion ? undefined : 'Upload a resume first to add versions'}
          className={buildActiveTabClass(uploadMode === 'version')}
        >
          New Version
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-5 md:p-6">
        {uploadMode === 'new' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="vault-hub-name" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Resume Name
              </label>
              <input
                id="vault-hub-name"
                value={resumeName}
                onChange={(event) => setResumeName(event.target.value)}
                placeholder="e.g., Frontend Dev - Tech Corp"
                className="vault-hub-field"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="vault-hub-tags" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Tags (Optional)
              </label>
              <input
                id="vault-hub-tags"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="e.g., React, UI/UX, 2024"
                className="vault-hub-field"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <label htmlFor="vault-hub-base" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Select Base Resume
              </label>
              <select
                id="vault-hub-base"
                value={baseResumeId}
                onChange={(event) => setBaseResumeId(event.target.value)}
                className="vault-hub-field"
              >
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.is_active ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="vault-hub-notes" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Version Notes
              </label>
              <textarea
                id="vault-hub-notes"
                value={versionNotes}
                onChange={(event) => setVersionNotes(event.target.value)}
                placeholder="What changed in this version? (e.g., Tailored for Google PM role, added recent metric)"
                rows={2}
                className="vault-hub-field resize-none"
              />
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="sr-only"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openFilePicker();
            }
          }}
          onClick={openFilePicker}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            selectFile(event.dataTransfer.files?.[0] ?? null);
          }}
          className={['vault-hub-dropzone', isDragOver ? 'vault-hub-dropzone--active' : ''].join(' ')}
        >
          <div className="vault-hub-dropzone__icon" aria-hidden>
            <Upload className="h-7 w-7" />
          </div>
          <h3 className="type-headline-md text-[var(--color-on-surface)]">
            {selectedFile ? selectedFile.name : 'Drag & drop your file here'}
          </h3>
          <p className="type-body-md mt-2 max-w-md text-[var(--color-on-surface-variant)]">
            PDF, DOCX, or TXT — up to 5 MB. We parse structure automatically so interviews start
            with your real experience.
          </p>
          <span className="glass-panel type-label-md mt-6 inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] px-6 py-2.5 text-[var(--color-on-surface)] transition-colors hover:border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] hover:text-[var(--color-primary)]">
            Browse Files
          </span>
        </div>

        {selectedFile ? (
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-primary-container)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary-container)] shadow-luminous transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {uploading ? 'Uploading…' : uploadMode === 'new' ? 'Upload Resume' : 'Add Version'}
          </button>
        ) : null}
      </div>
    </form>
  );
}
