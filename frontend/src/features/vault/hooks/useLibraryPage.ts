import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useVaultLibraryContext } from '../context/VaultLibraryContext';
import type { VaultEntry } from '../types';
import { getVaultEntryScore } from '../utils/scorePresentation';
import { getErrorMessage } from '../utils/vaultUtils';

export type LibraryFilterMode = 'all' | 'active';
export type LibrarySortMode = 'updated' | 'name' | 'score';

function getUpdatedTimestamp(entry: VaultEntry): number {
  const raw = entry.last_updated ?? entry.created_at;
  if (!raw && raw !== 0) return 0;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof raw === 'object' && raw && 'seconds' in raw) {
    return raw.seconds * 1000;
  }
  return 0;
}

export function useLibraryPage() {
  const navigate = useNavigate();
  const { entries, meta, loading, isFetching, error, refresh, setActive, deleteEntry } = useVaultLibraryContext();

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<LibraryFilterMode>('all');
  const [sortMode, setSortMode] = useState<LibrarySortMode>('updated');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const isEntryActive = useCallback(
    (entry: VaultEntry) => entry.is_active || meta.active_resume_id === entry.id,
    [meta.active_resume_id],
  );

  const visibleEntries = useMemo(() => {
    let list = [...entries];

    if (filterMode === 'active') {
      list = list.filter(isEntryActive);
    }

    list.sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name);
      }

      if (sortMode === 'score') {
        const scoreA = getVaultEntryScore(a) ?? -1;
        const scoreB = getVaultEntryScore(b) ?? -1;
        return scoreB - scoreA;
      }

      return getUpdatedTimestamp(b) - getUpdatedTimestamp(a);
    });

    return list;
  }, [entries, filterMode, sortMode, isEntryActive]);

  const toggleFilterPanel = useCallback(() => {
    setFilterOpen((open) => !open);
  }, []);

  const changeFilterMode = useCallback((mode: LibraryFilterMode) => {
    setFilterMode(mode);
  }, []);

  const changeSortMode = useCallback((mode: LibrarySortMode) => {
    setSortMode(mode);
  }, []);

  const toggleRowMenu = useCallback((resumeId: string) => {
    setOpenMenuId((current) => (current === resumeId ? null : resumeId));
  }, []);

  const closeRowMenu = useCallback(() => {
    setOpenMenuId(null);
  }, []);

  const openResume = useCallback(
    (resumeId: string) => {
      closeRowMenu();
      navigate(`/resume-vault/r/${resumeId}`);
    },
    [closeRowMenu, navigate],
  );

  const setActiveResume = useCallback(
    async (resumeId: string) => {
      try {
        setPendingAction(`active-${resumeId}`);
        await setActive(resumeId);
        toast.success('Active resume updated');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to set active'));
      } finally {
        setPendingAction(null);
        closeRowMenu();
      }
    },
    [closeRowMenu, setActive],
  );

  const deleteResume = useCallback(
    async (resumeId: string) => {
      if (!window.confirm('Delete this resume and all versions?')) return;

      try {
        setPendingAction(`delete-${resumeId}`);
        await deleteEntry(resumeId);
        toast.success('Resume deleted');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to delete'));
      } finally {
        setPendingAction(null);
        closeRowMenu();
      }
    },
    [closeRowMenu, deleteEntry],
  );

  return {
    visibleEntries,
    loading,
    isFetching,
    error,
    filterOpen,
    filterMode,
    sortMode,
    openMenuId,
    pendingAction,
    refresh,
    toggleFilterPanel,
    changeFilterMode,
    changeSortMode,
    toggleRowMenu,
    closeRowMenu,
    openResume,
    setActiveResume,
    deleteResume,
    isEntryActive,
  };
}
