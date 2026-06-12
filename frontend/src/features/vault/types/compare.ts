import type { VaultCompareResponse } from './api';
import type { VaultEntry, VaultVersion } from './domain';

export interface VersionSelection {
  resumeId: string;
  versionId: string;
  entry: VaultEntry;
  version: VaultVersion;
}

export interface CompareResultState {
  result: VaultCompareResponse;
  selectionA: VersionSelection;
  selectionB: VersionSelection;
  role?: string;
}
