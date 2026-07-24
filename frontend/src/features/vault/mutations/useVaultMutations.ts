import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from 'shared/query/queryKeys';

import { vaultApi } from '../services/vaultApi';
import type {
  UploadResumePayload,
  VaultAnalyzeResponse,
  VaultCompareResponse,
  VaultEntry,
  VaultListResponse,
  VaultRestoreResponse,
  VaultStatusResponse,
  VaultUpdatePayload,
  VaultUploadResponse,
  VaultVersion,
} from '../types';
import { mergeVaultEntryScores } from '../utils/scorePresentation';

export function useVaultMutations() {
  const queryClient = useQueryClient();

  const invalidateEntries = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.vault.entries() });
  };

  const patchEntries = (updater: (current: VaultListResponse) => VaultListResponse) => {
    queryClient.setQueryData<VaultListResponse>(queryKeys.vault.entries(), (current) => {
      const base: VaultListResponse = current ?? {
        entries: [],
        meta: { resume_count: 0, active_resume_id: null },
      };
      return updater(base);
    });
  };

  const uploadResume = useMutation({
    mutationFn: (payload: UploadResumePayload) => vaultApi.uploadResume(payload),
    onSuccess: (res) => {
      patchEntries((current) => {
        const existing = current.entries.find((entry) => entry.id === res.entry.id);
        const merged = mergeVaultEntryScores(existing, {
          ...res.entry,
          scorecard: res.entry.scorecard ?? res.scorecard,
        });
        const entries = existing
          ? current.entries.map((entry) => (entry.id === res.entry.id ? merged : entry))
          : [merged, ...current.entries];
        return {
          ...current,
          entries,
          meta: {
            ...current.meta,
            resume_count: existing
              ? (current.meta?.resume_count ?? entries.length)
              : (current.meta?.resume_count ?? 0) + 1,
          },
        };
      });
      void invalidateEntries();
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (resumeId: string) => vaultApi.deleteEntry(resumeId),
    onSuccess: (_res, resumeId) => {
      patchEntries((current) => ({
        ...current,
        entries: current.entries.filter((entry) => entry.id !== resumeId),
        meta: {
          ...current.meta,
          resume_count: Math.max(0, (current.meta?.resume_count ?? current.entries.length) - 1),
          active_resume_id:
            current.meta?.active_resume_id === resumeId ? _res.active_resume_id ?? null : current.meta?.active_resume_id ?? null,
        },
      }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.vault.versions(resumeId) });
      void invalidateEntries();
    },
  });

  const setActive = useMutation({
    mutationFn: (resumeId: string) => vaultApi.setActive(resumeId),
    onSuccess: (_res, resumeId) => {
      patchEntries((current) => ({
        ...current,
        entries: current.entries.map((entry) => ({
          ...entry,
          is_active: entry.id === resumeId,
        })),
        meta: {
          ...current.meta,
          active_resume_id: resumeId,
        },
      }));
      void invalidateEntries();
    },
  });

  const updateMeta = useMutation({
    mutationFn: ({ resumeId, payload }: { resumeId: string; payload: VaultUpdatePayload }) =>
      vaultApi.updateEntry(resumeId, payload),
    onSuccess: (updated) => {
      patchEntries((current) => ({
        ...current,
        entries: current.entries.map((entry) => (entry.id === updated.id ? updated : entry)),
      }));
      void invalidateEntries();
    },
  });

  const reanalyze = useMutation({
    mutationFn: ({
      resumeId,
      versionId,
      role,
    }: {
      resumeId: string;
      versionId?: string | null;
      role?: string;
    }) => vaultApi.analyze(resumeId, versionId, role),
    onSuccess: (res, { resumeId, versionId }) => {
      if (res.entry_scorecard_updated) {
        patchEntries((current) => ({
          ...current,
          entries: current.entries.map((entry) =>
            entry.id === resumeId ? { ...entry, scorecard: res.scorecard } : entry,
          ),
        }));
      }
      if (versionId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.vault.version(versionId) });
      }
      void invalidateEntries();
    },
  });

  const restoreVersion = useMutation({
    mutationFn: ({ versionId, role }: { versionId: string; role?: string }) =>
      vaultApi.restoreVersion(versionId, role),
    onSuccess: (_res, { versionId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vault.version(versionId) });
      void invalidateEntries();
    },
  });

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
    const cached = queryClient.getQueryData<VaultVersion[]>(queryKeys.vault.versions(resumeId));
    if (cached) return cached;
    const res = await vaultApi.listVersions(resumeId);
    return res.versions ?? [];
  };

  return {
    uploadResume: (payload: UploadResumePayload): Promise<VaultUploadResponse> =>
      uploadResume.mutateAsync(payload),
    deleteEntry: (resumeId: string): Promise<VaultStatusResponse> => deleteEntry.mutateAsync(resumeId),
    setActive: (resumeId: string): Promise<VaultStatusResponse> => setActive.mutateAsync(resumeId),
    updateMeta: (resumeId: string, payload: VaultUpdatePayload): Promise<VaultEntry> =>
      updateMeta.mutateAsync({ resumeId, payload }),
    reanalyze: (
      resumeId: string,
      versionId?: string | null,
      role?: string,
    ): Promise<VaultAnalyzeResponse> => reanalyze.mutateAsync({ resumeId, versionId, role }),
    restoreVersion: (versionId: string, role?: string): Promise<VaultRestoreResponse> =>
      restoreVersion.mutateAsync({ versionId, role }),
    compare,
    getVersions,
  };
}
