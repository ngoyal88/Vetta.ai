import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';

import type { VaultEntry } from '../types';
import { getErrorMessage, validateResumeFile } from '../utils/vaultUtils';

export type UploadMode = 'new' | 'version';

interface VaultUploadFormProps {
  entries: VaultEntry[];
  initialMode?: UploadMode;
  initialResumeId?: string | null;
  uploading: boolean;
  onUpload: (payload: {
    mode: UploadMode;
    file: File;
    name: string;
    tags: string;
    resumeId?: string;
    userNote?: string;
  }) => Promise<void>;
}

export default function VaultUploadForm({
  entries,
  initialMode = 'new',
  initialResumeId = null,
  uploading,
  onUpload,
}: VaultUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<UploadMode>(initialMode);
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState(initialResumeId || entries[0]?.id || '');
  const [userNote, setUserNote] = useState('');
  const [dragActive, setDragActive] = useState(false);

  React.useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  React.useEffect(() => {
    if (initialResumeId) setResumeId(initialResumeId);
  }, [initialResumeId]);

  const selectedEntry = entries.find((e) => e.id === resumeId);
  const canAddVersion = entries.length > 0;

  const pickFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    const validation = validateResumeFile(next);
    if (validation) {
      toast.error(validation);
      return;
    }
    setFile(next);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragActive(false);
      const dropped = event.dataTransfer.files?.[0] ?? null;
      pickFile(dropped);
    },
    [pickFile],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const validation = validateResumeFile(file);
      if (validation) {
        throw new Error(validation);
      }
      if (!file) return;

      if (mode === 'new' && !name.trim()) {
        throw new Error('Name is required');
      }
      if (mode === 'version' && !resumeId) {
        throw new Error('Select a resume');
      }

      await onUpload({
        mode,
        file,
        name: mode === 'new' ? name.trim() : selectedEntry?.name || name.trim(),
        tags: mode === 'new' ? tags : (selectedEntry?.tags || []).join(', '),
        resumeId: mode === 'version' ? resumeId : undefined,
        userNote: mode === 'version' ? userNote : undefined,
      });

      setFile(null);
      setName('');
      setTags('');
      setUserNote('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'));
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
          aria-selected={mode === 'new'}
          onClick={() => setMode('new')}
          className={['vault-hub-tab', mode === 'new' ? 'vault-hub-tab--active' : ''].join(' ')}
        >
          New Resume
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'version'}
          onClick={() => canAddVersion && setMode('version')}
          disabled={!canAddVersion}
          title={canAddVersion ? undefined : 'Upload a resume first to add versions'}
          className={['vault-hub-tab', mode === 'version' ? 'vault-hub-tab--active' : ''].join(' ')}
        >
          New Version
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-5 md:p-6">
        {mode === 'new' ? (
          <div className="animate-fade-in grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="vault-resume-name" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Resume Name
              </label>
              <input
                id="vault-resume-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g., Frontend Dev - Tech Corp"
                className="vault-hub-field"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="vault-resume-tags" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Tags (Optional)
              </label>
              <input
                id="vault-resume-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="e.g., React, UI/UX, 2024"
                className="vault-hub-field"
              />
            </div>
          </div>
        ) : (
          <div className="animate-fade-in flex flex-col gap-4">
            <div className="space-y-2">
              <label htmlFor="vault-base-resume" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Select Base Resume
              </label>
              <select
                id="vault-base-resume"
                value={resumeId}
                onChange={(event) => setResumeId(event.target.value)}
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
              <label htmlFor="vault-version-notes" className="type-label-sm text-[var(--color-on-surface-variant)]">
                Version Notes
              </label>
              <textarea
                id="vault-version-notes"
                value={userNote}
                onChange={(event) => setUserNote(event.target.value)}
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
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
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
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={['vault-hub-dropzone group', dragActive ? 'vault-hub-dropzone--active' : ''].join(' ')}
        >
          <div className="vault-hub-dropzone__icon" aria-hidden>
            <Upload className="h-7 w-7" />
          </div>
          <h3 className="type-headline-md text-[var(--color-on-surface)]">
            {file ? file.name : 'Drag & drop your file here'}
          </h3>
          <p className="type-body-md mt-2 max-w-md text-[var(--color-on-surface-variant)]">
            Supports PDF, DOCX, or TXT. Our AI will automatically parse and analyze the structure.
          </p>
          <span className="glass-panel type-label-md mt-6 inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] px-6 py-2.5 text-[var(--color-on-surface)] transition-colors group-hover:border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] group-hover:text-[var(--color-primary)]">
            Browse Files
          </span>
        </div>

        {file ? (
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-primary-container)] px-5 py-3 text-sm font-semibold text-[var(--color-on-primary-container)] shadow-luminous transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {uploading ? 'Uploading…' : mode === 'new' ? 'Upload Resume' : 'Add Version'}
          </button>
        ) : null}
      </div>
    </form>
  );
}
