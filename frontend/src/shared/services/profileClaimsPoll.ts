export type PipelineStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export type ProfileClaimsPollSnapshot = {
  items: unknown[];
  strength: unknown[];
  gaps: unknown[];
  session_id?: string;
  pipeline_status?: PipelineStatus | null;
  pipeline_stats?: Record<string, unknown> | null;
  pipeline_error?: { code?: string; message?: string } | null;
};

export const TERMINAL_PIPELINE_STATUSES: PipelineStatus[] = ['completed', 'failed', 'skipped'];

export const DEFAULT_PROFILE_CLAIMS_POLL_MAX_WAIT_MS = 120_000;
export const DEFAULT_PROFILE_CLAIMS_POLL_INTERVAL_MS = 2_000;
export const DEFAULT_PROFILE_CLAIMS_POLL_MAX_DELAY_MS = 8_000;

export type PollSessionProfileClaimsResult<T extends ProfileClaimsPollSnapshot = ProfileClaimsPollSnapshot> =
  T & {
    pollExhausted: boolean;
  };

export type ProfileClaimsPollOptions = {
  intervalMs?: number;
  maxWaitMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export function isTerminalPipelineStatus(status: PipelineStatus | null | undefined): boolean {
  return Boolean(status && TERMINAL_PIPELINE_STATUSES.includes(status));
}

export async function runProfileClaimsPoll<T extends ProfileClaimsPollSnapshot>(
  fetchSnapshot: () => Promise<T>,
  options: ProfileClaimsPollOptions = {},
): Promise<PollSessionProfileClaimsResult<T>> {
  const intervalMs = options.intervalMs ?? DEFAULT_PROFILE_CLAIMS_POLL_INTERVAL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_PROFILE_CLAIMS_POLL_MAX_WAIT_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_PROFILE_CLAIMS_POLL_MAX_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());

  const startedAt = now();
  let attempt = 0;
  let last = { items: [], strength: [], gaps: [] } as T;

  while (now() - startedAt < maxWaitMs) {
    last = await fetchSnapshot();
    if (isTerminalPipelineStatus(last.pipeline_status)) {
      return { ...last, pollExhausted: false };
    }

    const delay = Math.min(intervalMs * 2 ** attempt, maxDelayMs);
    if (now() - startedAt + delay >= maxWaitMs) {
      break;
    }
    await sleep(delay);
    attempt += 1;
  }

  if (!isTerminalPipelineStatus(last.pipeline_status)) {
    last = await fetchSnapshot();
    if (isTerminalPipelineStatus(last.pipeline_status)) {
      return { ...last, pollExhausted: false };
    }
  }

  return { ...last, pollExhausted: !isTerminalPipelineStatus(last.pipeline_status) };
}
