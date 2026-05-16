import React, { useState } from 'react';
import toast from 'react-hot-toast';

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
  const [mode, setMode] = useState<UploadMode>(initialMode);
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState(initialResumeId || entries[0]?.id || '');
  const [userNote, setUserNote] = useState('');

  React.useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  React.useEffect(() => {
    if (initialResumeId) setResumeId(initialResumeId);
  }, [initialResumeId]);

  const selectedEntry = entries.find((e) => e.id === resumeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'));
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-1)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.28)]"
    >
      <div className="flex flex-wrap gap-2">
        {(['new', 'version'] as UploadMode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={[
              'rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition',
              mode === value
                ? 'border-[var(--teal-2)] bg-[var(--emerald-dim)] text-[var(--cream-0)]'
                : 'border-[var(--border)] bg-[var(--bg-2)] text-[var(--cream-3)] hover:border-[var(--teal-2)]/50',
            ].join(' ')}
          >
            {value === 'new' ? 'New resume' : 'New version'}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {mode === 'new' ? (
          <>
            <label className="block text-xs text-[var(--cream-3)]">
              Resume name
              <input
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)] outline-none focus:border-[var(--teal-2)]"
              />
            </label>
            <label className="block text-xs text-[var(--cream-3)]">
              Tags (comma-separated)
              <input
                value={tags}
                onChange={(ev) => setTags(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)] outline-none focus:border-[var(--teal-2)]"
              />
            </label>
          </>
        ) : (
          <>
            <label className="block text-xs text-[var(--cream-3)]">
              Resume
              <select
                value={resumeId}
                onChange={(ev) => setResumeId(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)] outline-none focus:border-[var(--teal-2)]"
              >
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-[var(--cream-3)]">
              Version note (optional)
              <input
                value={userNote}
                onChange={(ev) => setUserNote(ev.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)] outline-none focus:border-[var(--teal-2)]"
              />
            </label>
          </>
        )}

        <label className="block text-xs text-[var(--cream-3)]">
          File (PDF, DOCX, TXT — max 5 MB)
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(ev) => setFile(ev.target.files?.[0] || null)}
            className="mt-2 block w-full text-sm text-[var(--cream-2)] file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--bg-2)] file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.12em] file:text-[var(--cream-1)]"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="mt-6 w-full rounded-xl bg-[var(--teal-2)] px-4 py-3 text-sm font-medium text-[var(--cream-0)] transition hover:opacity-90 disabled:opacity-40"
      >
        {uploading ? 'Uploading…' : mode === 'new' ? 'Upload resume' : 'Add version'}
      </button>
    </form>
  );
}
