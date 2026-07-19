import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { isTerminalPipelineStatus } from 'shared/services/profileClaimsPoll';
import { api, type PipelineStatus, type ProfileClaim } from 'shared/services/api';

type UseSessionProfileClaimsResult = {
  strengthClaims: ProfileClaim[];
  gapClaims: ProfileClaim[];
  loading: boolean;
  pipelineStatus: PipelineStatus | null;
  pipelinePending: boolean;
  pollExhausted: boolean;
  pipelineFailed: boolean;
  pipelineSkipped: boolean;
  actingId: string | null;
  refetch: () => void;
  acceptClaim: (claim: ProfileClaim) => Promise<void>;
  rejectClaim: (claim: ProfileClaim) => Promise<void>;
};

export function useSessionProfileClaims(sessionId?: string): UseSessionProfileClaimsResult {
  const [strengthClaims, setStrengthClaims] = useState<ProfileClaim[]>([]);
  const [gapClaims, setGapClaims] = useState<ProfileClaim[]>([]);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [fetchGeneration, setFetchGeneration] = useState(0);

  const loadClaims = useCallback(async (targetSessionId: string, cancelled: () => boolean) => {
    try {
      setLoading(true);
      setPollExhausted(false);
      const payload = await api.pollSessionProfileClaims(targetSessionId);
      if (cancelled()) return;
      setStrengthClaims((payload.strength || []) as ProfileClaim[]);
      setGapClaims((payload.gaps || []) as ProfileClaim[]);
      setPipelineStatus(payload.pipeline_status ?? null);
      setPollExhausted(payload.pollExhausted);
    } catch {
      if (!cancelled()) setPipelineStatus('failed');
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    void loadClaims(sessionId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [sessionId, fetchGeneration, loadClaims]);

  const refetch = useCallback(() => {
    if (!sessionId) return;
    setFetchGeneration((value) => value + 1);
  }, [sessionId]);

  const acceptClaim = useCallback(async (claim: ProfileClaim) => {
    try {
      setActingId(claim.id);
      await api.acceptProfileClaim(claim.id);
      setStrengthClaims((prev) => prev.filter((row) => row.id !== claim.id));
      toast.success('Claim added to profile');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to accept claim');
    } finally {
      setActingId(null);
    }
  }, []);

  const rejectClaim = useCallback(async (claim: ProfileClaim) => {
    try {
      setActingId(claim.id);
      await api.rejectProfileClaim(claim.id);
      setStrengthClaims((prev) => prev.filter((row) => row.id !== claim.id));
      setGapClaims((prev) => prev.filter((row) => row.id !== claim.id));
      toast.success('Claim dismissed');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject claim');
    } finally {
      setActingId(null);
    }
  }, []);

  const pipelinePending =
    !isTerminalPipelineStatus(pipelineStatus) &&
    (pipelineStatus === 'running' ||
      pipelineStatus === 'queued' ||
      pipelineStatus === null);

  return {
    strengthClaims,
    gapClaims,
    loading,
    pipelineStatus,
    pipelinePending,
    pollExhausted,
    pipelineFailed: pipelineStatus === 'failed',
    pipelineSkipped: pipelineStatus === 'skipped',
    actingId,
    refetch,
    acceptClaim,
    rejectClaim,
  };
}
