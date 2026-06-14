import React, { useCallback } from 'react';

import type { VaultEntry } from 'features/vault/types';
import type { VersionSelection } from 'features/vault/types/compare';
import { VAULT_COMPARE_COPY } from 'features/vault/constants/compareContent';
import VaultComparePicker from './VaultComparePicker';
import VaultCompareSubmitBar from './VaultCompareSubmitBar';

type VaultCompareWorkspaceProps = {
  entries: VaultEntry[];
  selectionA: VersionSelection | null;
  selectionB: VersionSelection | null;
  role: string;
  canSubmit: boolean;
  canCompare: boolean;
  comparing: boolean;
  onSelectionAChange: (selection: VersionSelection | null) => void;
  onSelectionBChange: (selection: VersionSelection | null) => void;
  onRoleChange: (value: string) => void;
  onSubmit: () => void;
};

export default function VaultCompareWorkspace({
  entries,
  selectionA,
  selectionB,
  role,
  canSubmit,
  canCompare,
  comparing,
  onSelectionAChange,
  onSelectionBChange,
  onRoleChange,
  onSubmit,
}: VaultCompareWorkspaceProps) {
  const stableSetA = useCallback((s: VersionSelection | null) => onSelectionAChange(s), [onSelectionAChange]);
  const stableSetB = useCallback((s: VersionSelection | null) => onSelectionBChange(s), [onSelectionBChange]);

  return (
    <div className="vault-compare-workspace">
      <div className="vault-compare-workspace__panels">
        <VaultComparePicker
          side="a"
          entries={entries}
          selection={selectionA}
          onChange={stableSetA}
        />

        <div className="vault-compare-workspace__vs" aria-hidden>
          <span className="vault-compare-workspace__vs-badge">{VAULT_COMPARE_COPY.vs}</span>
        </div>

        <VaultComparePicker
          side="b"
          entries={entries}
          selection={selectionB}
          onChange={stableSetB}
        />
      </div>

      <VaultCompareSubmitBar
        role={role}
        canSubmit={canSubmit}
        canCompare={canCompare}
        comparing={comparing}
        onRoleChange={onRoleChange}
        onSubmit={onSubmit}
      />
    </div>
  );
}
