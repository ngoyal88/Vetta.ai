/** Cache policy presets — staleTime / gcTime in milliseconds. */

export const queryPolicies = {
  list: {
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  },
  catalog: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  },
  detail: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  },
  settings: {
    staleTime: 2 * 60_000,
    gcTime: 15 * 60_000,
  },
} as const;
