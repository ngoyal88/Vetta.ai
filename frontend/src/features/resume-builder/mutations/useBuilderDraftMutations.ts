import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from 'shared/query/queryKeys';

import { resumeBuilderApi } from '../services/resumeBuilderApi';
import type { CreateDraftPayload, DraftPatchPayload, SaveDraftPayload } from '../types/resumeBuilder';

export function useBuilderDraftMutations() {
  const queryClient = useQueryClient();

  const invalidateDrafts = async (draftId?: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.resumeBuilder.drafts() });
    if (draftId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.resumeBuilder.draft(draftId) });
    }
  };

  const createDraft = async (payload: CreateDraftPayload) => {
    const response = await resumeBuilderApi.createDraft(payload);
    await invalidateDrafts(response.draft.id);
    return response;
  };

  const patchDraft = async (draftId: string, payload: DraftPatchPayload) => {
    const response = await resumeBuilderApi.patchDraft(draftId, payload);
    queryClient.setQueryData(queryKeys.resumeBuilder.draft(draftId), response.draft);
    await invalidateDrafts(draftId);
    return response;
  };

  const saveDraft = async (draftId: string, payload: SaveDraftPayload) => {
    const response = await resumeBuilderApi.saveDraft(draftId, payload);
    queryClient.setQueryData(queryKeys.resumeBuilder.draft(draftId), response.draft);
    await invalidateDrafts(draftId);
    return response;
  };

  const deleteDraft = async (draftId: string) => {
    await resumeBuilderApi.deleteDraft(draftId);
    queryClient.removeQueries({ queryKey: queryKeys.resumeBuilder.draft(draftId) });
    await invalidateDrafts();
  };

  const duplicateDraft = async (draftId: string) => {
    const response = await resumeBuilderApi.duplicateDraft(draftId);
    await invalidateDrafts(response.draft.id);
    return response;
  };

  const publishDraft = async (draftId: string, payload: Parameters<typeof resumeBuilderApi.publishDraft>[1]) => {
    const response = await resumeBuilderApi.publishDraft(draftId, payload);
    await invalidateDrafts(draftId);
    await queryClient.invalidateQueries({ queryKey: queryKeys.vault.entries() });
    return response;
  };

  return {
    createDraft,
    patchDraft,
    saveDraft,
    deleteDraft,
    duplicateDraft,
    publishDraft,
    invalidateDrafts,
  };
}
