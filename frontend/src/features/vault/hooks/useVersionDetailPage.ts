import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import { vaultApi } from '../services/vaultApi';
import type { VaultScorecard, VaultVersion } from '../types';
import {
  buildCoverageBars,
  buildSuggestionCards,
  formatLastAnalyzedLabel,
  getVersionDisplayScore,
} from '../utils/versionDetailPresentation';
import { getErrorMessage } from '../utils/vaultUtils';

export function useVersionDetailPage() {
  const { resumeId, versionId } = useParams<{ resumeId: string; versionId: string }>();
  const navigate = useNavigate();
  const { entries, setActive, restoreVersion, reanalyze } = useVaultLibraryContext();

  const [version, setVersion] = useState<VaultVersion | null>(null);
  const [versionScorecard, setVersionScorecard] = useState<VaultScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState<'insights' | 'document'>('document');
  const [pendingRestore, setPendingRestore] = useState(false);
  const [pendingActive, setPendingActive] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const entry = useMemo(
    () => entries.find((item) => item.id === resumeId) ?? null,
    [entries, resumeId],
  );

  const loadVersion = useCallback(async () => {
    if (!versionId) return;
    const loaded = await vaultApi.getVersion(versionId);
    if (resumeId && loaded.resume_id !== resumeId) {
      throw new Error('Version not found');
    }
    setVersion(loaded);
    return loaded;
  }, [resumeId, versionId]);

  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const loaded = await loadVersion();
        if (cancelled || !loaded) return;
        if (entry?.current_version_id === loaded.id && entry.scorecard) {
          setVersionScorecard(entry.scorecard);
        } else {
          setVersionScorecard(null);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load version'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [versionId, loadVersion, entry?.current_version_id, entry?.scorecard]);

  const activeScorecard = versionScorecard ?? (entry?.current_version_id === version?.id ? entry?.scorecard : null);

  const presentation = useMemo(() => {
    if (!version) return null;
    const score = getVersionDisplayScore(entry, version, activeScorecard ?? undefined);
    return {
      score,
      summaryLine: activeScorecard?.summary_line ?? version.diff_summary ?? entry?.scorecard?.summary_line ?? '',
      coverageBars: buildCoverageBars(activeScorecard?.coverage_counts),
      atsFlags: activeScorecard?.ats_flags ?? [],
      suggestions: buildSuggestionCards(activeScorecard?.suggestions, activeScorecard?.weak_areas),
      lastAnalyzedLabel: formatLastAnalyzedLabel(activeScorecard?.last_analyzed_at ?? version.created_at),
      filename: version.source_filename || `${entry?.name || 'resume'}-v${version.version_number}.pdf`,
      isCurrentHead: entry?.current_version_id === version.id,
      isEntryActive: Boolean(entry?.is_active),
    };
  }, [activeScorecard, entry, version]);

  const handleReanalyze = useCallback(async () => {
    if (!entry || !versionId) return;
    try {
      setReanalyzing(true);
      const res = await reanalyze(entry.id, versionId);
      setVersionScorecard(res.scorecard);
      const refreshed = await vaultApi.getVersion(versionId);
      setVersion(refreshed);
      toast.success('Re-analyzed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Re-analysis failed'));
    } finally {
      setReanalyzing(false);
    }
  }, [entry, reanalyze, versionId]);

  const handleRestore = useCallback(async () => {
    if (!versionId) return;
    try {
      setPendingRestore(true);
      await restoreVersion(versionId);
      const refreshed = await loadVersion();
      if (refreshed) setVersion(refreshed);
      toast.success('Version restored to head');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Restore failed'));
    } finally {
      setPendingRestore(false);
    }
  }, [loadVersion, restoreVersion, versionId]);

  const handleSetActive = useCallback(async () => {
    if (!entry) return;
    try {
      setPendingActive(true);
      await setActive(entry.id);
      toast.success('Set as active resume');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to set active'));
    } finally {
      setPendingActive(false);
    }
  }, [entry, setActive]);

  const openInBuilder = useCallback(() => {
    if (!resumeId || !versionId) return;
    navigate(
      `/resume-vault/builder?resumeId=${encodeURIComponent(resumeId)}&versionId=${encodeURIComponent(versionId)}`,
    );
  }, [navigate, resumeId, versionId]);

  return {
    resumeId,
    versionId,
    entry,
    version,
    presentation,
    loading,
    error,
    mobileTab,
    setMobileTab,
    reanalyzing,
    pendingRestore,
    pendingActive,
    handleReanalyze,
    handleRestore,
    handleSetActive,
    openInBuilder,
  };
}
