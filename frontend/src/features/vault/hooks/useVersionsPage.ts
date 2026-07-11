import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import type { CompareResultState } from 'features/vault/types/compare';
import { vaultApi } from 'features/vault/services/vaultApi';
import type { VaultEntry, VaultVersion } from 'features/vault/types';
import { getVaultEntryScore } from 'features/vault/utils/scorePresentation';
import { getErrorMessage, normalizeTagInput } from 'features/vault/utils/vaultUtils';

import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { useVaultVersions } from './useVaultVersions';

export function useVersionsPage() {
  const { resumeId } = useParams<{ resumeId: string }>();
  const navigate = useNavigate();
  const { entries, loading: libraryLoading, updateMeta, restoreVersion, uploadResume } = useVaultLibraryContext();
  const { versions, loading, error, refresh } = useVaultVersions(resumeId);

  const entry = useMemo(
    () => (resumeId ? entries.find((e) => e.id === resumeId) : undefined),
    [entries, resumeId],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const headVersion = useMemo(() => {
    if (!entry?.current_version_id) return versions[0] ?? null;
    return versions.find((v) => v.id === entry.current_version_id) ?? versions[0] ?? null;
  }, [entry?.current_version_id, versions]);

  const compatScore = entry ? getVaultEntryScore(entry) : null;

  const openEdit = useCallback(() => {
    if (!entry) return;
    setEditName(entry.name);
    setEditTags((entry.tags || []).join(', '));
    setEditOpen(true);
  }, [entry]);

  const closeEdit = useCallback(() => setEditOpen(false), []);

  const openAddVersion = useCallback(() => setAddVersionOpen(true), []);
  const closeAddVersion = useCallback(() => setAddVersionOpen(false), []);

  const uploadVersion = useCallback(
    async (file: File, userNote: string) => {
      if (!resumeId || !entry) return;
      try {
        setUploadingVersion(true);
        await uploadResume({
          file,
          name: entry.name,
          tags: (entry.tags || []).join(', '),
          resumeId,
          userNote: userNote || undefined,
        });
        await refresh();
        setAddVersionOpen(false);
        toast.success('Version added');
      } finally {
        setUploadingVersion(false);
      }
    },
    [entry, refresh, resumeId, uploadResume],
  );

  const saveMeta = useCallback(async () => {
    if (!resumeId || !editName.trim()) {
      toast.error('Resume name cannot be blank');
      return;
    }
    try {
      setSavingMeta(true);
      await updateMeta(resumeId, { name: editName.trim(), tags: normalizeTagInput(editTags) });
      setEditOpen(false);
      toast.success('Resume updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally {
      setSavingMeta(false);
    }
  }, [editName, editTags, resumeId, updateMeta]);

  const previewVersion = useCallback(
    (versionId: string) => {
      if (!resumeId) return;
      navigate(`/resume-vault/r/${resumeId}/${versionId}`);
    },
    [navigate, resumeId],
  );

  const openInBuilder = useCallback(
    (versionId: string) => {
      if (!resumeId) return;
      navigate(
        `/resume-vault/builder?resumeId=${encodeURIComponent(resumeId)}&versionId=${encodeURIComponent(versionId)}`,
      );
    },
    [navigate, resumeId],
  );

  const downloadVersion = useCallback(async (version: VaultVersion) => {
    if (!version.has_source_file) {
      toast.error('No file stored for this version');
      return;
    }
    const actionKey = `download-${version.id}`;
    try {
      setPendingAction(actionKey);
      const blob = await vaultApi.fetchVersionFile(version.id);
      const filename = version.source_filename || `resume-v${version.version_number}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Download failed'));
    } finally {
      setPendingAction(null);
    }
  }, []);

  const compareVersion = useCallback(
    async (version: VaultVersion) => {
      if (!resumeId || !entry || !headVersion) return;
      if (headVersion.id === version.id) {
        navigate('/resume-vault/compare');
        return;
      }

      const actionKey = `compare-${version.id}`;
      try {
        setPendingAction(actionKey);
        const result = await vaultApi.compare(
          resumeId,
          resumeId,
          undefined,
          headVersion.id,
          version.id,
        );
        const state: CompareResultState = {
          result,
          selectionA: { resumeId, versionId: headVersion.id, entry, version: headVersion },
          selectionB: { resumeId, versionId: version.id, entry, version },
        };
        navigate('/resume-vault/compare/result', { state });
      } catch (err) {
        toast.error(getErrorMessage(err, 'Comparison failed'));
      } finally {
        setPendingAction(null);
      }
    },
    [entry, headVersion, navigate, resumeId],
  );

  const restoreVersionById = useCallback(
    async (versionId: string) => {
      const actionKey = `restore-${versionId}`;
      try {
        setPendingAction(actionKey);
        await restoreVersion(versionId);
        await refresh();
        toast.success('Version restored');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Restore failed'));
      } finally {
        setPendingAction(null);
      }
    },
    [refresh, restoreVersion],
  );

  const isCurrentVersion = useCallback(
    (version: VaultVersion) => entry?.current_version_id === version.id,
    [entry?.current_version_id],
  );

  const entryNotFound = Boolean(resumeId && !libraryLoading && !entry && entries.length > 0);

  return {
    resumeId,
    entry,
    entryNotFound,
    versions,
    headVersion,
    compatScore,
    loading,
    error,
    refresh,
    editOpen,
    addVersionOpen,
    uploadingVersion,
    editName,
    editTags,
    savingMeta,
    pendingAction,
    setEditName,
    setEditTags,
    openEdit,
    closeEdit,
    openAddVersion,
    closeAddVersion,
    uploadVersion,
    saveMeta,
    previewVersion,
    openInBuilder,
    downloadVersion,
    compareVersion,
    restoreVersionById,
    isCurrentVersion,
  };
}

export type VersionsPageEntry = VaultEntry | undefined;
