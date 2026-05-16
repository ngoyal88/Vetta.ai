import React, { useEffect, useState } from 'react';

import { vaultApi } from '../services/vaultApi';
import type { VaultEntry, VaultVersion } from '../types';
import { formatShortDate } from '../utils/vaultUtils';

export interface VersionSelection {
  resumeId: string;
  versionId: string;
  entry: VaultEntry;
  version: VaultVersion;
}

interface VaultResumePickerProps {
  label: string;
  entries: VaultEntry[];
  selection: VersionSelection | null;
  onChange: (selection: VersionSelection | null) => void;
}

export default function VaultResumePicker({ label, entries, selection, onChange }: VaultResumePickerProps) {
  const [resumeId, setResumeId] = useState(selection?.resumeId || entries[0]?.id || '');
  const [versions, setVersions] = useState<VaultVersion[]>([]);
  const [versionId, setVersionId] = useState(selection?.versionId || '');
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    if (!resumeId) {
      setVersions([]);
      setVersionId('');
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoadingVersions(true);
        const res = await vaultApi.listVersions(resumeId);
        if (cancelled) return;
        const list = res.versions || [];
        setVersions(list);
        setVersionId((current) => {
          if (current && list.some((v) => v.id === current)) return current;
          return list[0]?.id || '';
        });
      } catch {
        if (!cancelled) setVersions([]);
      } finally {
        if (!cancelled) setLoadingVersions(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  useEffect(() => {
    const entry = entries.find((e) => e.id === resumeId);
    const version = versions.find((v) => v.id === versionId);
    if (entry && version) {
      onChange({ resumeId, versionId, entry, version });
    } else {
      onChange(null);
    }
  }, [resumeId, versionId, entries, versions, onChange]);

  const version = versions.find((v) => v.id === versionId);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--teal-1)]">{label}</p>

      <label className="mt-4 block text-xs text-[var(--cream-3)]">
        Resume
        <select
          value={resumeId}
          onChange={(e) => setResumeId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)]"
        >
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-xs text-[var(--cream-3)]">
        Version
        <select
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          disabled={loadingVersions || !versions.length}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm text-[var(--cream-1)] disabled:opacity-50"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version_number} · {formatShortDate(v.created_at)} · score {v.score_at_version ?? '—'}
            </option>
          ))}
        </select>
      </label>

      {version ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-xs text-[var(--cream-3)]">
          <div className="truncate text-[var(--cream-1)]">
            {version.source_filename || `version ${version.version_number}`}
          </div>
          {!version.has_source_file ? (
            <p className="mt-1 text-[var(--red-1)]">No file stored — PDF preview unavailable</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
