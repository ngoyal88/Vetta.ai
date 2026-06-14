import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import {
  api,
  type ProfileClaim,
  type ProfileMemorySummaryV1,
  type ReadinessResponse,
  type ReadinessSnapshot,
} from 'shared/services/api';
import type { SectionFilter } from '../components/ClaimsInbox';

export type ProfileMemoryState = {
  summary: ProfileMemorySummaryV1;
  timeline: ProfileClaim[];
} | null;

export function useSignalIntelligence() {
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('pending');
  const [claims, setClaims] = useState<ProfileClaim[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [memory, setMemory] = useState<ProfileMemoryState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessHistory, setReadinessHistory] = useState<ReadinessSnapshot[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const refreshClaims = useCallback(async (section: SectionFilter) => {
    const sectionArg = section === 'profile' ? 'strength' : section === 'gaps' ? 'gap' : undefined;
    const [claimsRes, memoryRes] = await Promise.all([
      api.getProfileClaims('pending', 100, sectionArg),
      api.getProfileMemory(120),
    ]);
    setClaims(claimsRes.items || []);
    setMemory(memoryRes as ProfileMemoryState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshClaims(sectionFilter);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionFilter, refreshClaims]);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  }, []);

  const acceptOne = useCallback(async (item: ProfileClaim) => {
    try {
      setActingId(item.id);
      await api.acceptProfileClaim(item.id);
      setClaims((prev) => prev.filter((entry) => entry.id !== item.id));
      setSelected((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      toast.success('Claim accepted');
      setMemory((await api.getProfileMemory(120)) as ProfileMemoryState);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  }, []);

  const rejectOne = useCallback(async (item: ProfileClaim) => {
    try {
      setActingId(item.id);
      await api.rejectProfileClaim(item.id);
      setClaims((prev) => prev.filter((entry) => entry.id !== item.id));
      setSelected((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      toast.success('Claim rejected');
      setMemory((await api.getProfileMemory(120)) as ProfileMemoryState);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  }, []);

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
        await refreshClaims(sectionFilter);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Bulk update failed');
      } finally {
        setBulkBusy(false);
      }
    },
    [refreshClaims, sectionFilter, selected],
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
    loading,
    error,
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
