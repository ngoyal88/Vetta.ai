export type PairTrackId = "dsa" | "lld" | "bugfix";

export type PairTrackDefinition = {
  id: PairTrackId;
  title: string;
  description: string;
  live: boolean;
};

/** Catalog tracks for Pair Programming setup. Only DSA is startable today. */
export const PAIR_TRACKS: readonly PairTrackDefinition[] = [
  {
    id: "dsa",
    title: "Data Structures & Algorithms",
    description: "Array, graph, and DP problems with a live IDE and test runner.",
    live: true,
  },
  {
    id: "lld",
    title: "Low-Level Design",
    description: "Design classes and APIs under realistic constraints.",
    live: false,
  },
  {
    id: "bugfix",
    title: "Bug Fixing & Refactoring",
    description: "Diagnose broken code and ship a clean fix.",
    live: false,
  },
] as const;

export const PAIR_FOCUS_CHIPS = ["Arrays", "Graphs", "Heaps", "Backtracking"] as const;

export function isLivePairTrack(id: string | null | undefined): boolean {
  return (id || "").toLowerCase() === "dsa";
}
