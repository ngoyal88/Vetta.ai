import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useConfirmDialog } from 'shared/context/ConfirmDialogContext';
import { useAuth } from 'shared/context/AuthContext';
import { useUserSettingsQuery } from 'features/dashboard/queries/useUserSettingsQuery';

import { useBuilderDraftMutations } from '../mutations/useBuilderDraftMutations';
import {
  useBuilderDraftsQuery,
  useBuilderHealthQuery,
  useBuilderTemplatesQuery,
} from '../queries/useBuilderCatalogQueries';
import {
  buildInitialProfile,
  isProfileReady,
  resolveBuilderIdentity,
  type BuilderIdentity,
} from '../utils/builderIdentity';
import { getDraftDisplayName } from '../utils/draftNames';

const BUILDER_ENABLED = import.meta.env.VITE_RESUME_BUILDER_ENABLED === 'true';
const DEFAULT_TEMPLATE_ID = 'professional_v1';
const FOCUS_RING_CLASS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-2)]';

type RenameTarget = {
  draftId: string;
  defaultName: string;
} | null;

export function useBuilderLanding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirmDialog } = useConfirmDialog();
  const { currentUser } = useAuth();

  const { health, isLoading: healthLoading, error: healthError } = useBuilderHealthQuery();
  const { templates, loading: templatesLoading } = useBuilderTemplatesQuery();
  const { drafts: savedDrafts, loading: draftsLoading, refresh: refreshDrafts } = useBuilderDraftsQuery();
  const { settings: settingsDoc, loading: settingsLoading } = useUserSettingsQuery();
  const draftMutations = useBuilderDraftMutations();

  const [saving, setSaving] = useState(false);
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [openMenuDraftId, setOpenMenuDraftId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const isLandingRoute = !location.pathname.match(/\/builder\/[^/]+$/);

  const catalogLoading =
    BUILDER_ENABLED &&
    isLandingRoute &&
    (healthLoading || templatesLoading || draftsLoading || settingsLoading);

  const profileIdentity = useMemo(
    () => resolveBuilderIdentity(settingsDoc, currentUser),
    [currentUser, settingsDoc],
  );

  const error = useMemo(() => {
    if (!BUILDER_ENABLED) return 'Resume Builder is disabled.';
    if (health && !health.enabled) return 'Resume Builder is disabled.';
    if (healthError instanceof Error) return healthError.message;
    return null;
  }, [health, healthError]);

  const announce = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  const requireProfile = useCallback((): BuilderIdentity | null => {
    if (!profileIdentity || !isProfileReady(profileIdentity)) {
      const message = !profileIdentity?.name.trim()
        ? 'Add your name in Profile before creating a Builder draft.'
        : 'Add your email in Profile before creating a Builder draft.';
      toast.error(message);
      announce(message);
      return null;
    }
    return profileIdentity;
  }, [announce, profileIdentity]);

  const createBlankDraft = useCallback(async () => {
    const identity = requireProfile();
    if (!identity) return;

    try {
      setSaving(true);
      const response = await draftMutations.createDraft({
        template_id: DEFAULT_TEMPLATE_ID,
        profile: buildInitialProfile(identity),
      });
      toast.success('Draft created');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('builder_show_template_hint', '1');
      }
      navigate(`/resume-vault/builder/${response.draft.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create draft');
    } finally {
      setSaving(false);
    }
  }, [draftMutations, navigate, requireProfile]);

  const createDraftFromVault = useCallback(
    async (resumeId: string) => {
      try {
        setSaving(true);
        const response = await draftMutations.createDraft({
          template_id: DEFAULT_TEMPLATE_ID,
          resume_id: resumeId,
        });
        setVaultPickerOpen(false);
        toast.success('Draft created from your resume');
        navigate(`/resume-vault/builder/${response.draft.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create draft from Vault');
      } finally {
        setSaving(false);
      }
    },
    [draftMutations, navigate],
  );

  const openDraft = useCallback(
    (draftId: string) => {
      navigate(`/resume-vault/builder/${draftId}`);
    },
    [navigate],
  );

  const renameDraft = useCallback(
    async (draftId: string, name: string) => {
      try {
        setSaving(true);
        await draftMutations.patchDraft(draftId, { name });
        setRenameTarget(null);
        toast.success('Draft renamed');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to rename draft');
      } finally {
        setSaving(false);
      }
    },
    [draftMutations],
  );

  const deleteDraft = useCallback(
    (draftId: string) => {
      const draft = savedDrafts.find((item) => item.id === draftId);
      const label = draft ? getDraftDisplayName(draft) : 'this draft';
      confirmDialog({
        title: 'Delete Draft',
        message: `Delete ${label}? This cannot be undone.`,
        destructive: true,
        onConfirm: async () => {
          try {
            await draftMutations.deleteDraft(draftId);
            setOpenMenuDraftId(null);
            toast.success('Draft deleted');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete draft');
          }
        },
      });
    },
    [confirmDialog, draftMutations, savedDrafts],
  );

  const duplicateDraft = useCallback(
    async (draftId: string) => {
      try {
        setSaving(true);
        const response = await draftMutations.duplicateDraft(draftId);
        setOpenMenuDraftId(null);
        toast.success(`Copy created — ${getDraftDisplayName(response.draft)}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to duplicate draft');
      } finally {
        setSaving(false);
      }
    },
    [draftMutations],
  );

  const toggleMenu = useCallback((draftId: string) => {
    setOpenMenuDraftId((current) => (current === draftId ? null : draftId));
  }, []);

  return {
    builderEnabled: BUILDER_ENABLED,
    focusRingClass: FOCUS_RING_CLASS,
    catalogLoading,
    saving,
    error,
    templates,
    savedDrafts,
    profileIdentity,
    profileReady: isProfileReady(profileIdentity),
    statusMessage,
    vaultPickerOpen,
    openVaultPicker: () => setVaultPickerOpen(true),
    closeVaultPicker: () => setVaultPickerOpen(false),
    openMenuDraftId,
    toggleMenu,
    renameTarget,
    openRename: (draftId: string, defaultName: string) => {
      setOpenMenuDraftId(null);
      setRenameTarget({ draftId, defaultName });
    },
    closeRename: () => setRenameTarget(null),
    createBlankDraft,
    createDraftFromVault,
    openDraft,
    renameDraft,
    deleteDraft,
    duplicateDraft,
    refreshDrafts,
  };
}
