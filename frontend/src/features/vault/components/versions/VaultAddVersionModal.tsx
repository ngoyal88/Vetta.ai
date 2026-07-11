import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from 'shared/components/Modal';

import type { VaultEntry } from 'features/vault/types';
import { getErrorMessage, validateResumeFile } from 'features/vault/utils/vaultUtils';

type VaultAddVersionModalProps = {
  open: boolean;
  entry: VaultEntry | null;
  uploading: boolean;
  onClose: () => void;
  onUpload: (file: File, userNote: string) => Promise<void>;
};

const fieldClass =
  'mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-0)] px-3 py-2.5 text-[var(--color-on-surface)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-primary)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] resize-none';

export default function VaultAddVersionModal({
  open,
  entry,
  uploading,
  onClose,
  onUpload,
}: VaultAddVersionModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setVersionNotes('');
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

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

    try {
      await onUpload(selectedFile, versionNotes.trim());
      resetForm();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'));
    }
  };

  return (
    <Modal open={open && Boolean(entry)} onClose={onClose} title="Add version">
      {entry ? (
        <form className="space-y-5 text-[var(--color-on-surface)]" onSubmit={(event) => void handleSubmit(event)}>
          <p className="type-body-md text-[var(--color-on-surface-variant)]">
            Upload a new file for <span className="font-semibold text-[var(--color-on-surface)]">{entry.name}</span>.
            We will parse it and add it to this resume&apos;s version history.
          </p>

          <label className="block text-sm">
            <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
              Version notes (optional)
            </span>
            <textarea
              value={versionNotes}
              onChange={(event) => setVersionNotes(event.target.value)}
              rows={2}
              placeholder="What changed? e.g. Tailored for Google PM role"
              className={fieldClass}
            />
          </label>

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
              <Upload className="h-6 w-6" />
            </div>
            <p className="type-label-md text-[var(--color-on-surface)]">
              {selectedFile ? selectedFile.name : 'Drag & drop your file here'}
            </p>
            <p className="type-body-sm mt-1 text-[var(--color-on-surface-variant)]">PDF, DOCX, or TXT — up to 5 MB</p>
            <span className="type-label-sm mt-4 inline-flex rounded-lg border border-[var(--border-strong)] px-4 py-2 text-[var(--color-on-surface)]">
              Browse files
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-xl border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container-high)] disabled:opacity-45"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {uploading ? 'Uploading…' : 'Add version'}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
