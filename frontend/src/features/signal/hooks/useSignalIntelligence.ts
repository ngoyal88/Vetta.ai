import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

import {
  api,
  type ProfileClaim,
  type ReadinessResponse,
  type ReadinessSnapshot,
} from 'shared/services/api';
import { invalidateProfileCaches } from 'shared/query/invalidateCaches';

import type { SectionFilter } from '../components/ClaimsInbox';
import {
  useProfileClaimsQuery,
  useProfileMemoryQuery,
  type ProfileMemoryState,
} from '../queries/useProfileQueries';

export type { ProfileMemoryState };

export function useSignalIntelligence() {
  const queryClient = useQueryClient();
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('pending');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessHistory, setReadinessHistory] = useState<ReadinessSnapshot[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const {
    claims,
    loading: claimsLoading,
    error: claimsError,
  } = useProfileClaimsQuery(sectionFilter);
  const { memory } = useProfileMemoryQuery(120);

  const invalidateProfile = useCallback(async () => {
    await invalidateProfileCaches(queryClient);
  }, [queryClient]);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  }, []);

  const acceptOne = useCallback(
    async (item: ProfileClaim) => {
      try {
        setActingId(item.id);
        await api.acceptProfileClaim(item.id);
        setSelected((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        toast.success('Claim accepted');
        await invalidateProfile();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setActingId(null);
      }
    },
    [invalidateProfile],
  );

  const rejectOne = useCallback(
    async (item: ProfileClaim) => {
      try {
        setActingId(item.id);
        await api.rejectProfileClaim(item.id);
        setSelected((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        toast.success('Claim rejected');
        await invalidateProfile();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setActingId(null);
      }
    },
    [invalidateProfile],
  );

  const bulkUpdate = useCallback(
    async (action: 'accepted' | 'rejected') => {
      const ids = Object.keys(selected).filter((id) => selected[id]);
      if (!ids.length) return;
      try {
        setBulkBusy(true);
        await api.bulkUpdateProfileClaims(
          ids.map((id) => ({ claim_id: id, status: action })),
        );
        toast.success('Bulk update complete');
        setSelected({});
        await invalidateProfile();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Bulk update failed');
      } finally {
        setBulkBusy(false);
      }
    },
    [invalidateProfile, selected],
  );

  const computeReadiness = useCallback(async () => {
    if (!targetRole.trim()) {
      toast.error('Target role is required');
      return;
    }
    try {
      setReadinessLoading(true);
      const score = await api.computeReadiness({
        target_role: targetRole.trim(),
        job_description: jobDescription.trim(),
      });
      setReadiness(score);
      const history = await api.getReadinessHistory(targetRole.trim(), jobDescription.trim(), 20);
      setReadinessHistory(history.history || []);
      toast.success('Readiness updated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Readiness compute failed');
    } finally {
      setReadinessLoading(false);
    }
  }, [jobDescription, targetRole]);

  return {
    sectionFilter,
    setSectionFilter,
    claims,
    selected,
    memory,
    loading: claimsLoading,
    error: claimsError,
    actingId,
    bulkBusy,
    targetRole,
    jobDescription,
    readiness,
    readinessHistory,
    readinessLoading,
    setTargetRole,
    setJobDescription,
    toggleSelected,
    acceptOne,
    rejectOne,
    bulkUpdate,
    computeReadiness,
  };
}
