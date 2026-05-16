import { useCallback, useEffect, useState } from 'react';

import { vaultApi } from '../services/vaultApi';
import type {
  UploadResumePayload,
  VaultAnalyzeResponse,
  VaultCompareResponse,
  VaultEntry,
  VaultMeta,
  VaultRestoreResponse,
  VaultStatusResponse,
  VaultUpdatePayload,
  VaultUploadResponse,
  VaultVersion,
} from '../types';

export const useVaultLibrary = () => {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [meta, setMeta] = useState<VaultMeta>({ resume_count: 0, active_resume_id: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await vaultApi.listEntries();
      setEntries(data.entries || []);
      setMeta(data.meta || { resume_count: 0, active_resume_id: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load vault';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadResume = async (payload: UploadResumePayload): Promise<VaultUploadResponse> => {
    const res = await vaultApi.uploadResume(payload);
    await refresh();
    return res;
  };

  const deleteEntry = async (resumeId: string): Promise<VaultStatusResponse> => {
    const res = await vaultApi.deleteEntry(resumeId);
    await refresh();
    return res;
  };

  const setActive = async (resumeId: string): Promise<VaultStatusResponse> => {
    const res = await vaultApi.setActive(resumeId);
    await refresh();
    return res;
  };

  const updateMeta = async (resumeId: string, payload: VaultUpdatePayload): Promise<VaultEntry> => {
    const res = await vaultApi.updateEntry(resumeId, payload);
    await refresh();
    return res;
  };

  const reanalyze = async (
    resumeId: string,
    versionId?: string | null,
    role?: string,
  ): Promise<VaultAnalyzeResponse> => {
    const res = await vaultApi.analyze(resumeId, versionId, role);
    await refresh();
    return res;
  };

  const compare = async (
    resumeAId: string,
    resumeBId: string,
    role?: string,
    versionAId?: string,
    versionBId?: string,
  ): Promise<VaultCompareResponse> => {
    return vaultApi.compare(resumeAId, resumeBId, role, versionAId, versionBId);
  };

  const getVersions = async (resumeId: string): Promise<VaultVersion[]> => {
    const res = await vaultApi.listVersions(resumeId);
    return res.versions || [];
  };

  const restoreVersion = async (versionId: string, role?: string): Promise<VaultRestoreResponse> => {
    const res = await vaultApi.restoreVersion(versionId, role);
    await refresh();
    return res;
  };

  return {
    entries,
    meta,
    loading,
    error,
    refresh,
    uploadResume,
    deleteEntry,
    setActive,
    updateMeta,
    reanalyze,
    compare,
    getVersions,
    restoreVersion,
  };
};
