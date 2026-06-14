import React, { useId } from 'react';
import { FlaskConical, Target } from 'lucide-react';

import { VAULT_COMPARE_COPY } from 'features/vault/constants/compareContent';

type VaultCompareSubmitBarProps = {
  role: string;
  canSubmit: boolean;
  canCompare: boolean;
  comparing: boolean;
  onRoleChange: (value: string) => void;
  onSubmit: () => void;
};

export default function VaultCompareSubmitBar({
  role,
  canSubmit,
  canCompare,
  comparing,
  onRoleChange,
  onSubmit,
}: VaultCompareSubmitBarProps) {
  const copy = VAULT_COMPARE_COPY;
  const roleId = useId();
  const disabled = !canSubmit || comparing || !canCompare;

  return (
    <div className="vault-compare-submit">
      <div className="vault-compare-submit__role">
        <label htmlFor={roleId} className="vault-compare-submit__label">
          <Target className="h-4 w-4" aria-hidden />
          {copy.targetRoleLabel}{' '}
          <span className="vault-compare-submit__optional">{copy.targetRoleOptional}</span>
        </label>
        <input
          id={roleId}
          type="text"
          value={role}
          onChange={(event) => onRoleChange(event.target.value)}
          placeholder={copy.targetRolePlaceholder}
          className="vault-compare-submit__input"
        />
        <p className="vault-compare-submit__hint">{copy.targetRoleHint}</p>
      </div>

      <button
        type="button"
        disabled={disabled}
        title={!canCompare ? copy.needTwoVersions : undefined}
        onClick={onSubmit}
        className={[
          'vault-compare-submit__btn',
          disabled ? 'vault-compare-submit__btn--disabled' : 'vault-compare-submit__btn--active',
        ].join(' ')}
      >
        <FlaskConical className="h-5 w-5" aria-hidden />
        {comparing ? copy.comparing : copy.startComparison}
      </button>
    </div>
  );
}
