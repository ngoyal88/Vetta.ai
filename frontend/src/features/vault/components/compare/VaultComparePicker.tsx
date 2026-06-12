import React, { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { VAULT_COMPARE_COPY } from 'features/vault/constants/compareContent';
import { vaultApi } from 'features/vault/services/vaultApi';
import type { VaultEntry, VaultVersion } from 'features/vault/types';
import type { VersionSelection } from 'features/vault/types/compare';
import { formatShortDate } from 'features/vault/utils/vaultUtils';

export type ComparePickerSide = 'a' | 'b';

type VaultComparePickerProps = {
  side: ComparePickerSide;
  entries: VaultEntry[];
  selection: VersionSelection | null;
  onChange: (selection: VersionSelection | null) => void;
};

function formatVariantLabel(version: VaultVersion): string {
  const date = formatShortDate(version.created_at);
  const score = version.score_at_version ?? version.latest_score;
  const scoreLabel = score != null ? ` · score ${score}` : '';
  return `v${version.version_number} · ${date}${scoreLabel}`;
}

export default function VaultComparePicker({
  side,
  entries,
  selection,
  onChange,
}: VaultComparePickerProps) {
  const copy = VAULT_COMPARE_COPY;
  const documentId = useId();
  const variantId = useId();
  const isA = side === 'a';

  const [resumeId, setResumeId] = useState(selection?.resumeId ?? '');
  const [versionId, setVersionId] = useState(selection?.versionId ?? '');
  const [versions, setVersions] = useState<VaultVersion[]>([]);
  const [versionsForResumeId, setVersionsForResumeId] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const handleResumeChange = (nextResumeId: string) => {
    setResumeId(nextResumeId);
    setVersions([]);
    setVersionsForResumeId(null);
    setVersionId('');
    setLoadingVersions(Boolean(nextResumeId));
  };

  useEffect(() => {
    if (!resumeId) {
      setVersions([]);
      setVersionsForResumeId(null);
      setVersionId('');
      setLoadingVersions(false);
      return;
    }

    let cancelled = false;
    setLoadingVersions(true);
    setVersionsForResumeId(null);

    const load = async () => {
      try {
        const res = await vaultApi.listVersions(resumeId);
        if (cancelled) return;
        const list = res.versions || [];
        setVersions(list);
        setVersionsForResumeId(resumeId);
        setVersionId((current) => {
          if (current && list.some((v) => v.id === current)) return current;
          return list[0]?.id ?? '';
        });
      } catch {
        if (!cancelled) {
          setVersions([]);
          setVersionsForResumeId(resumeId);
          setVersionId('');
        }
      } finally {
        if (!cancelled) setLoadingVersions(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  useEffect(() => {
    const entry = entries.find((e) => e.id === resumeId);
    const version = versions.find((v) => v.id === versionId);
    if (entry && version) {
      onChange({ resumeId, versionId, entry, version });
    } else {
      onChange(null);
    }
  }, [resumeId, versionId, entries, versions, onChange]);

  const versionsReady = Boolean(resumeId) && versionsForResumeId === resumeId;
  const variantsLoading = Boolean(resumeId) && (loadingVersions || !versionsReady);
  const variantDisabled = !resumeId || variantsLoading || versions.length === 0;
  const variantPlaceholder = !resumeId
    ? copy.variantPlaceholder
    : variantsLoading
      ? copy.variantLoading
      : versions.length === 0
        ? copy.variantEmpty
        : copy.selectVariant;

  return (
    <div
      className={[
        'vault-compare-picker glass-panel',
        isA ? 'vault-compare-picker--a' : 'vault-compare-picker--b',
      ].join(' ')}
    >
      <div className="vault-compare-picker__header">
        <div
          className={[
            'vault-compare-picker__badge',
            isA ? 'vault-compare-picker__badge--a' : 'vault-compare-picker__badge--b',
          ].join(' ')}
        >
          {isA ? 'A' : 'B'}
        </div>
        <h3 className="type-headline-md text-[var(--color-on-surface)]">
          {isA ? copy.resumeATitle : copy.resumeBTitle}
        </h3>
      </div>

      <div className="vault-compare-picker__fields">
        <div>
          <label htmlFor={documentId} className="vault-compare-picker__label">
            {copy.selectDocument}
          </label>
          <div className="vault-compare-picker__select-wrap">
            <select
              id={documentId}
              value={resumeId}
              onChange={(event) => handleResumeChange(event.target.value)}
              className="vault-compare-picker__select"
            >
              <option value="">{copy.documentPlaceholder}</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <ChevronDown className="vault-compare-picker__chevron" aria-hidden />
          </div>
        </div>

        <div>
          <label htmlFor={variantId} className="vault-compare-picker__label">
            {copy.selectVariant}
          </label>
          <div className="vault-compare-picker__select-wrap">
            <select
              id={variantId}
              value={versionId}
              disabled={variantDisabled}
              onChange={(event) => setVersionId(event.target.value)}
              className={['vault-compare-picker__select', variantDisabled ? 'vault-compare-picker__select--disabled' : ''].join(' ')}
            >
              <option value="">{variantPlaceholder}</option>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {formatVariantLabel(version)}
                </option>
              ))}
            </select>
            <ChevronDown className="vault-compare-picker__chevron" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
