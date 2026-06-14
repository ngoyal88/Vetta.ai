export type DifficultyApiLevel = 'easy' | 'medium' | 'hard';

export type DifficultyStop = {
  value: number;
  stopLabel: string;
  badge: string;
  api: DifficultyApiLevel;
};

export const ROLE_TARGETED_DIFFICULTY_STOPS: readonly DifficultyStop[] = [
  { value: 1, stopLabel: 'Casual', badge: 'Easy', api: 'easy' },
  { value: 2, stopLabel: 'Standard', badge: 'Standard', api: 'medium' },
  { value: 3, stopLabel: 'Brutal', badge: 'Hard (FAANG)', api: 'hard' },
] as const;

export const RESUME_SCAN_DEPTH_STOPS: readonly DifficultyStop[] = [
  { value: 1, stopLabel: 'Surface (Fast)', badge: 'Surface (Fast)', api: 'easy' },
  { value: 2, stopLabel: 'Balanced', badge: 'Balanced', api: 'medium' },
  { value: 3, stopLabel: 'Neural (Deep)', badge: 'Neural (Deep)', api: 'hard' },
] as const;

export function findDifficultyStop(
  stops: readonly DifficultyStop[],
  value: number,
): DifficultyStop {
  return stops.find((stop) => stop.value === value) ?? stops[Math.floor(stops.length / 2)];
}

export function difficultyProgressPercent(value: number, stopCount: number): string {
  if (stopCount <= 1) return '0%';
  return `${((value - 1) / (stopCount - 1)) * 100}%`;
}
