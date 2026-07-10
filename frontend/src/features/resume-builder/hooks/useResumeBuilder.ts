import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useConfirmDialog } from 'shared/context/ConfirmDialogContext';
import { useAuth } from 'shared/context/AuthContext';
import { fetchUserSettings } from 'features/dashboard/services/userSettingsService';

import type {
  ResumeAchievementItem,
  ResumeEducationRecord,
  ResumeProfile,
  ResumeProjectItem,
  ResumePublicationItem,
  ResumeWorkExperienceItem,
} from 'features/vault/types/domain';
import { createEmptySkillGroup, ensureBuilderSkillGroups, type BuilderSkillGroup } from 'features/vault/utils/resumeSkills';

import { sanitizeBuilderProfileForSave } from '../utils/sanitizeBuilderProfile';

import { computeBuilderReadiness, type BuilderReadinessIssue } from '../utils/builderReadiness';
import { getDraftDisplayName, nextResumeDraftName } from '../utils/draftNames';
import { applyDraftSnapshot, captureDraftSnapshot } from '../utils/draftSnapshot';
import type { HistoryMode } from './draftHistoryStack';
import type { SaveState } from './draftAutosave';
import { useDraftAutosave } from './useDraftAutosave';
import { useDraftHistory } from './useDraftHistory';
import { ResumeBuilderApiError, resumeBuilderApi } from '../services/resumeBuilderApi';
import type {
  BuilderCustomSection,
  BuilderSection,
  PublishDraftResponse,
  ResumeBuilderDraft,
  SaveDraftPayload,
  TemplateMetadata,
} from '../types/resumeBuilder';

const BUILDER_ENABLED = import.meta.env.VITE_RESUME_BUILDER_ENABLED === 'true';
const DEFAULT_TEMPLATE_ID = 'professional_v1';
const FOCUS_RING_CLASS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-2)]';

type BuilderIdentity = {
  name: string;
  email: string;
};

const buildDraftFingerprint = (draft: ResumeBuilderDraft | null): string =>
  JSON.stringify(
    draft
      ? {
          name: draft.name,
          template_id: draft.template_id,
          profile: draft.profile,
          section_layout: draft.section_layout,
          custom_sections: draft.custom_sections,
          target_resume_id: draft.target_resume_id ?? null,
        }
      : null,
  );

function cloneProfile(profile: ResumeProfile): ResumeProfile {
  return JSON.parse(JSON.stringify(profile)) as ResumeProfile;
}

function profileForPersistence(profile: ResumeProfile): ResumeProfile {
  return sanitizeBuilderProfileForSave(cloneProfile(profile));
}

function splitValues(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}


function createWorkExperienceItem(): ResumeWorkExperienceItem {
  return {
    title: '',
    company: '',
    location: '',
    start_date: '',
    end_date: '',
    responsibilities: [''],
    impact: [],
    tech_stack: [],
  };
}

function createEducationItem(): ResumeEducationRecord {
  return {
    degree: '',
    field: '',
    institution: '',
    start_date: '',
    end_date: '',
    cgpa: '',
    location: '',
    highlights: [],
  };
}

function createProjectItem(): ResumeProjectItem {
  return {
    name: '',
    role: '',
    description: '',
    link: '',
    tech_stack: [],
    start_date: '',
    end_date: '',
  };
}

function createAchievementItem(): ResumeAchievementItem {
  return {
    title: '',
    description: '',
    date: '',
  };
}

function createPublicationItem(): ResumePublicationItem {
  return {
    title: '',
    venue: '',
    year: '',
    link: '',
  };
}

function buildDefaultResumeName(profile: ResumeProfile): string {
  if (typeof profile.name === 'string' && profile.name.trim()) {
    return `${profile.name.trim()} Resume`;
  }
  return 'Vetta Resume';
}

function buildInitialProfile(identity: BuilderIdentity): ResumeProfile {
  return {
    name: identity.name,
    contact: {
      email: identity.email,
      phone: '',
      location: '',
      links: { github: '', linkedin: '', portfolio: '', other: [] },
    },
    summary: '',
  };
}

function mapPublishApiErrorToIssue(error: ResumeBuilderApiError): BuilderReadinessIssue | null {
  switch (error.code) {
    case 'identity_name_missing':
      return {
        id: 'server-identity-name-missing',
        severity: 'blocking',
        category: 'identity',
        dimension: 'identity',
        title: 'Name is required to publish',
        message: error.message,
        sectionId: 'identity',
        fieldPath: 'profile.name',
      };
    case 'identity_email_missing':
    case 'identity_email_invalid':
      return {
        id: 'server-identity-email-invalid',
        severity: 'blocking',
        category: 'identity',
        dimension: 'identity',
        title: 'Email is required to publish',
        message: error.message,
        sectionId: 'identity',
        fieldPath: 'profile.contact.email',
      };
    case 'content_empty_resume':
      return {
        id: 'server-content-empty-resume',
        severity: 'blocking',
        category: 'content',
        dimension: 'content_presence',
        title: 'Resume has no content yet',
        message: error.message,
      };
    default:
      return null;
  }
}

function isValidIdentityEmail(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function resolveBuilderIdentity(
  settingsDoc: { name?: string; email?: string } | null,
  currentUser: { displayName?: string | null; email?: string | null } | null,
): BuilderIdentity | null {
  const name = settingsDoc?.name?.trim() || currentUser?.displayName?.trim() || '';
  const settingsEmail = settingsDoc?.email?.trim() || '';
  const authEmail = currentUser?.email?.trim() || '';
  const email = isValidIdentityEmail(settingsEmail) ? settingsEmail : authEmail;

  return name || email ? { name, email } : null;
}

function buildLegacyDraftIdentityRepair(
  nextDraft: ResumeBuilderDraft,
  identity: BuilderIdentity | null,
): SaveDraftPayload | null {
  const fallbackEmail = identity?.email?.trim() || '';
  if (!fallbackEmail || !isValidIdentityEmail(fallbackEmail)) return null;

  const currentEmail = nextDraft.profile.contact?.email?.trim() || '';
  if (isValidIdentityEmail(currentEmail)) return null;

  return {
        name: nextDraft.name?.trim() || nextResumeDraftName([]),
        profile: profileForPersistence({
      ...cloneProfile(nextDraft.profile),
      contact: {
        ...(nextDraft.profile.contact || {}),
        email: fallbackEmail,
      },
    }),
    section_layout: nextDraft.section_layout,
    custom_sections: nextDraft.custom_sections,
    target_resume_id: nextDraft.target_resume_id ?? null,
  };
}

function isModifiedNavigation(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function useResumeBuilder() {
  const navigate = useNavigate();
  const { draftId } = useParams<{ draftId: string }>();
  const [searchParams] = useSearchParams();
  const { confirmDialog } = useConfirmDialog();
  const { currentUser } = useAuth();

  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [draft, setDraft] = useState<ResumeBuilderDraft | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [previewsLoading, setPreviewsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [latexLoading, setLatexLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'ready' | 'failed'>('idle');
  const [pageCount, setPageCount] = useState(0);
  const [latex, setLatex] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [savedDrafts, setSavedDrafts] = useState<ResumeBuilderDraft[]>([]);
  const [profileIdentity, setProfileIdentity] = useState<BuilderIdentity | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState<string>(buildDraftFingerprint(null));
  const [statusMessage, setStatusMessage] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMode, setPublishMode] = useState<'new' | 'existing'>('new');
  const [publishResumeName, setPublishResumeName] = useState('Vetta Resume');
  const [publishUserNote, setPublishUserNote] = useState('');
  const [publishTags, setPublishTags] = useState('');
  const [publishSetActive, setPublishSetActive] = useState(true);
  const [navigationBlockOpen, setNavigationBlockOpen] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const [saveDraftOpen, setSaveDraftOpen] = useState(false);
  const [saveDraftName, setSaveDraftName] = useState('Resume(1)');
  const [templatePreviewUrls, setTemplatePreviewUrls] = useState<Record<string, string>>({});
  const [publishServerIssue, setPublishServerIssue] = useState<BuilderReadinessIssue | null>(null);

  const draftFingerprint = useMemo(() => buildDraftFingerprint(draft), [draft]);
  const dirty = draftFingerprint !== savedFingerprint;
  const hasExistingPublishTarget = Boolean(draft?.target_resume_id || draft?.source_resume_id);
  const profileReady = Boolean(profileIdentity?.name.trim() && profileIdentity?.email.trim());

  const cleanupPreviewUrl = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  useEffect(() => cleanupPreviewUrl, [cleanupPreviewUrl]);

  useEffect(() => () => {
    Object.values(templatePreviewUrls).forEach((url) => URL.revokeObjectURL(url));
  }, [templatePreviewUrls]);

  const suggestDraftName = useCallback((currentDraft?: ResumeBuilderDraft | null) => {
    if (currentDraft?.name?.trim()) {
      return currentDraft.name.trim();
    }
    const otherNames = savedDrafts
      .filter((savedDraft) => savedDraft.id !== currentDraft?.id)
      .map((savedDraft) => getDraftDisplayName(savedDraft));
    return nextResumeDraftName(otherNames);
  }, [savedDrafts]);

  useEffect(() => {
    if (!dirty) {
      setNavigationBlockOpen(false);
      setPendingNavigationHref(null);
    }
  }, [dirty]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return undefined;

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isModifiedNavigation(event)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const nextUrl = new URL(anchor.href, window.location.origin);
      if (nextUrl.origin !== window.location.origin) return;

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (currentPath === nextPath) return;

      event.preventDefault();
      setPendingNavigationHref(nextPath);
      setNavigationBlockOpen(true);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [dirty]);

  const announce = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  const draftHistory = useDraftHistory();
  // draftHistory is a fresh object on every edit (canUndo/canRedo/revision change),
  // so hold its actions in a ref — callbacks that only *use* history (load/clear/undo)
  // must not depend on that churning identity or they re-run on every keystroke.
  const historyRef = useRef(draftHistory);
  historyRef.current = draftHistory;
  const draftRef = useRef<ResumeBuilderDraft | null>(null);
  draftRef.current = draft;

  const applyDraftState = useCallback(
    (
      nextDraft: ResumeBuilderDraft,
      { replaceRoute = true, preserveUi = false }: { replaceRoute?: boolean; preserveUi?: boolean } = {},
    ) => {
      setDraft(nextDraft);
      setSavedFingerprint(buildDraftFingerprint(nextDraft));
      setPublishServerIssue(null);
      setSelectedTemplateId(nextDraft.template_id);
      if (!preserveUi) {
        setSelectedSectionId(null);
        setPublishMode(nextDraft.target_resume_id || nextDraft.source_resume_id ? 'existing' : 'new');
        setPublishResumeName(buildDefaultResumeName(nextDraft.profile));
        setPublishUserNote('');
        setPublishTags('');
        setPublishSetActive(true);
      }
      if (replaceRoute) {
        navigate(`/resume-vault/builder/${nextDraft.id}`, { replace: true });
      }
    },
    [navigate],
  );

  const updateDraft = useCallback(
    (
      updater: (current: ResumeBuilderDraft) => ResumeBuilderDraft,
      options: { history?: HistoryMode } = {},
    ) => {
      const current = draftRef.current;
      if (!current) return;
      const historyMode = options.history ?? 'debounced';
      if (historyMode !== 'skip') {
        historyRef.current.recordBeforeChange(captureDraftSnapshot(current), historyMode);
      }
      setPublishServerIssue(null);
      setDraft((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        return next === prev ? prev : next;
      });
    },
    [],
  );

  const loadTemplatePreviews = useCallback(async (templateList: TemplateMetadata[]) => {
    setPreviewsLoading(true);
    try {
      const previewEntries = await Promise.all(
        templateList
          .filter((template) => template.preview_asset)
          .map(async (template) => {
            try {
              const blob = await resumeBuilderApi.getTemplatePreview(template.id);
              return [template.id, URL.createObjectURL(blob)] as const;
            } catch {
              return null;
            }
          }),
      );
      setTemplatePreviewUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        return Object.fromEntries(
          previewEntries.filter((entry): entry is readonly [string, string] => Boolean(entry)),
        );
      });
    } finally {
      setPreviewsLoading(false);
    }
  }, []);

  const loadDraftWorkspace = useCallback(
    async (targetDraftId: string, identity: BuilderIdentity) => {
      setWorkspaceLoading(true);
      try {
        const draftResponse = await resumeBuilderApi.getDraft(targetDraftId);
        let nextDraft = draftResponse.draft;
        const repairPayload = buildLegacyDraftIdentityRepair(nextDraft, identity);
        if (repairPayload) {
          const repairedResponse = await resumeBuilderApi.saveDraft(targetDraftId, repairPayload);
          nextDraft = repairedResponse.draft;
        }
        historyRef.current.clear();
        applyDraftState(nextDraft, { replaceRoute: false });
        const latexResponse = await resumeBuilderApi.getLatex(targetDraftId);
        setLatex(latexResponse.tex);
        setPreviewStatus('idle');
      } finally {
        setWorkspaceLoading(false);
      }
    },
    [applyDraftState],
  );

  const loadInitial = useCallback(async () => {
    if (!BUILDER_ENABLED) {
      setError('Resume Builder is disabled.');
      setCatalogLoading(false);
      return;
    }

    setCatalogLoading(true);
    setError(null);
    const initialResumeId = searchParams.get('resumeId') || undefined;
    const initialVersionId = searchParams.get('versionId') || undefined;
    const shouldOpenWorkspace = Boolean(draftId || initialResumeId || initialVersionId);
    if (shouldOpenWorkspace) {
      setWorkspaceLoading(true);
    }

    try {
      const [health, templateResponse, draftsResponse, settingsDoc] = await Promise.all([
        resumeBuilderApi.getHealth(),
        resumeBuilderApi.listTemplates(),
        resumeBuilderApi.listDrafts(),
        currentUser ? fetchUserSettings(currentUser.uid).catch(() => null) : Promise.resolve(null),
      ]);
      if (!health.enabled) {
        throw new Error('Resume Builder is disabled.');
      }

      setTemplates(templateResponse.templates);
      setSavedDrafts(draftsResponse.drafts);
      setTemplatePreviewUrls((current) => {
        Object.values(current).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
      void loadTemplatePreviews(templateResponse.templates);

      const nextIdentity = resolveBuilderIdentity(settingsDoc, currentUser);
      setProfileIdentity(nextIdentity);

      const liveTemplate = templateResponse.templates.find((template) => template.status === 'live');
      if (liveTemplate) {
        setSelectedTemplateId(liveTemplate.id);
      }

      setCatalogLoading(false);

      if (draftId) {
        await loadDraftWorkspace(draftId, nextIdentity);
      } else if (initialResumeId || initialVersionId) {
        try {
          const draftResponse = await resumeBuilderApi.createDraft({
            template_id: liveTemplate?.id || DEFAULT_TEMPLATE_ID,
            resume_id: initialResumeId,
            version_id: initialVersionId,
          });
          applyDraftState(draftResponse.draft);
          historyRef.current.clear();
          announce('Draft created from your existing resume.');
        } finally {
          setWorkspaceLoading(false);
        }
      } else {
        setWorkspaceLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Resume Builder';
      setError(message);
      toast.error(message);
      setCatalogLoading(false);
      setWorkspaceLoading(false);
    }
  }, [
    announce,
    applyDraftState,
    currentUser,
    draftId,
    loadDraftWorkspace,
    loadTemplatePreviews,
    searchParams,
  ]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const createDraft = useCallback(async (templateId?: string) => {
    const trimmedName = profileIdentity?.name.trim() || '';
    const trimmedEmail = profileIdentity?.email.trim() || '';
    if (!trimmedName || !trimmedEmail) {
      const message = !trimmedName
        ? 'Add your name in Profile before creating a Builder draft.'
        : 'Add your email in Profile before creating a Builder draft.';
      toast.error(message);
      announce(message);
      return;
    }
    try {
      setSaving(true);
      const response = await resumeBuilderApi.createDraft({
        template_id: templateId || selectedTemplateId,
        resume_id: searchParams.get('resumeId') || undefined,
        version_id: searchParams.get('versionId') || undefined,
        profile: buildInitialProfile({ name: trimmedName, email: trimmedEmail }),
      });
      applyDraftState(response.draft);
      historyRef.current.clear();
      setSavedDrafts((current) => [response.draft, ...current.filter((item) => item.id !== response.draft.id)]);
      setLatex('');
      setPreviewStatus('idle');
      announce('Draft created.');
      toast.success('Draft created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create draft');
    } finally {
      setSaving(false);
    }
  }, [announce, applyDraftState, profileIdentity, searchParams, selectedTemplateId]);

  const openDraft = useCallback((nextDraftId: string) => {
    navigate(`/resume-vault/builder/${nextDraftId}`);
  }, [navigate]);

  const setDraftProfile = useCallback(
    (updater: (profile: ResumeProfile) => ResumeProfile, history: HistoryMode = 'debounced') => {
      updateDraft(
        (current) => ({ ...current, profile: updater(cloneProfile(current.profile)) }),
        { history },
      );
    },
    [updateDraft],
  );

  const setProfileLinks = useCallback(
    (field: 'github' | 'linkedin' | 'portfolio', value: string) => {
      setDraftProfile((profile) => ({
        ...profile,
        contact: {
          ...(profile.contact || {}),
          links: {
            ...(profile.contact?.links || {}),
            [field]: value,
          },
        },
      }));
    },
    [setDraftProfile],
  );

  const setProfileOtherLinks = useCallback((value: string) => {
    setDraftProfile((profile) => ({
      ...profile,
      contact: {
        ...(profile.contact || {}),
        links: {
          ...(profile.contact?.links || {}),
          other: splitValues(value),
        },
      },
    }));
  }, [setDraftProfile]);

  const setProfileName = useCallback((name: string) => {
    setDraftProfile((profile) => ({ ...profile, name }));
  }, [setDraftProfile]);

  const setProfileEmail = useCallback((email: string) => {
    setDraftProfile((profile) => ({
      ...profile,
      contact: { ...(profile.contact || {}), email },
    }));
  }, [setDraftProfile]);

  const setProfilePhone = useCallback((phone: string) => {
    setDraftProfile((profile) => ({
      ...profile,
      contact: { ...(profile.contact || {}), phone },
    }));
  }, [setDraftProfile]);

  const setProfileLocation = useCallback((location: string) => {
    setDraftProfile((profile) => ({
      ...profile,
      contact: { ...(profile.contact || {}), location },
    }));
  }, [setDraftProfile]);

  const setSummary = useCallback((summary: string) => {
    setDraftProfile((profile) => ({ ...profile, summary }));
  }, [setDraftProfile]);

  const replaceSectionItems = useCallback(
    <T,>(items: T[] | undefined, index: number, nextItem: T): T[] => {
      const nextItems = [...(items || [])];
      nextItems[index] = nextItem;
      return nextItems;
    },
    [],
  );

  const addWorkExperience = useCallback(() => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        work_experience: [...(profile.work_experience || []), createWorkExperienceItem()],
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const setWorkExperienceItem = useCallback((index: number, item: ResumeWorkExperienceItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      work_experience: replaceSectionItems(profile.work_experience, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeWorkExperience = useCallback((index: number) => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        work_experience: (profile.work_experience || []).filter((_, currentIndex) => currentIndex !== index),
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const addEducation = useCallback(() => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        education: [...(profile.education || []), createEducationItem()],
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const setEducationItem = useCallback((index: number, item: ResumeEducationRecord) => {
    setDraftProfile((profile) => ({
      ...profile,
      education: replaceSectionItems(profile.education, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeEducation = useCallback((index: number) => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        education: (profile.education || []).filter((_, currentIndex) => currentIndex !== index),
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const addEducationHighlight = useCallback((educationIndex: number) => {
    setDraftProfile((profile) => {
      const education = [...(profile.education || [])];
      const item = education[educationIndex];
      if (!item) return profile;
      education[educationIndex] = {
        ...item,
        highlights: [...(item.highlights || []), { label: '', text: '' }],
      };
      return { ...profile, education };
    }, 'immediate');
  }, [setDraftProfile]);

  const setEducationHighlight = useCallback(
    (educationIndex: number, highlightIndex: number, label: string, text: string) => {
      setDraftProfile((profile) => {
        const education = [...(profile.education || [])];
        const item = education[educationIndex];
        if (!item) return profile;
        const highlights = [...(item.highlights || [])];
        const current = highlights[highlightIndex];
        if (!current) return profile;
        highlights[highlightIndex] = { label, text };
        education[educationIndex] = { ...item, highlights };
        return { ...profile, education };
      });
    },
    [setDraftProfile],
  );

  const removeEducationHighlight = useCallback((educationIndex: number, highlightIndex: number) => {
    setDraftProfile((profile) => {
      const education = [...(profile.education || [])];
      const item = education[educationIndex];
      if (!item) return profile;
      education[educationIndex] = {
        ...item,
        highlights: (item.highlights || []).filter((_, currentIndex) => currentIndex !== highlightIndex),
      };
      return { ...profile, education };
    }, 'immediate');
  }, [setDraftProfile]);

  const setSkillGroup = useCallback((index: number, group: BuilderSkillGroup) => {
    setDraftProfile((profile) => {
      const skills = [...ensureBuilderSkillGroups(profile.skills)];
      skills[index] = group;
      return { ...profile, skills };
    });
  }, [setDraftProfile]);

  const addSkillGroup = useCallback(() => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        skills: [...ensureBuilderSkillGroups(profile.skills), createEmptySkillGroup()],
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const removeSkillGroup = useCallback((index: number) => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        skills: ensureBuilderSkillGroups(profile.skills).filter((_, currentIndex) => currentIndex !== index),
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const addProject = useCallback(() => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        projects: [...(profile.projects || []), createProjectItem()],
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const setProjectItem = useCallback((index: number, item: ResumeProjectItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      projects: replaceSectionItems(profile.projects, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeProject = useCallback((index: number) => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        projects: (profile.projects || []).filter((_, currentIndex) => currentIndex !== index),
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const addAchievement = useCallback(() => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        achievements: [...(profile.achievements || []), createAchievementItem()],
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const setAchievementItem = useCallback((index: number, item: ResumeAchievementItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      achievements: replaceSectionItems(profile.achievements, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeAchievement = useCallback((index: number) => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        achievements: (profile.achievements || []).filter((_, currentIndex) => currentIndex !== index),
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const addPublication = useCallback(() => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        publications: [...(profile.publications || []), createPublicationItem()],
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const setPublicationItem = useCallback((index: number, item: ResumePublicationItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      publications: replaceSectionItems(profile.publications, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removePublication = useCallback((index: number) => {
    setDraftProfile(
      (profile) => ({
        ...profile,
        publications: (profile.publications || []).filter((_, currentIndex) => currentIndex !== index),
      }),
      'immediate',
    );
  }, [setDraftProfile]);

  const renameSection = useCallback(
    (sectionId: string, label: string) => {
      updateDraft((current) => {
        const customSections = current.custom_sections.map((section) =>
          section.id === sectionId ? { ...section, title: label } : section,
        );
        return {
          ...current,
          section_layout: current.section_layout.map((section) =>
            section.id === sectionId ? { ...section, label } : section,
          ),
          custom_sections: customSections,
        };
      }, { history: 'immediate' });
    },
    [updateDraft],
  );

  const reorderSection = useCallback(
    (fromId: string, toId: string) => {
      updateDraft((current) => {
        const fromIndex = current.section_layout.findIndex((section) => section.id === fromId);
        const toIndex = current.section_layout.findIndex((section) => section.id === toId);
        if (fromIndex <= 0 || toIndex <= 0 || fromIndex === -1 || toIndex === -1) return current;
        const updated = [...current.section_layout];
        const [item] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, item);
        return { ...current, section_layout: updated };
      }, { history: 'immediate' });
    },
    [updateDraft],
  );

  const addCustomSection = useCallback(() => {
    const customId = `custom_${Date.now()}`;
    updateDraft((current) => {
      const nextCustom: BuilderCustomSection = { id: customId, title: 'New Section', content: '' };
      return {
        ...current,
        section_layout: [
          ...current.section_layout,
          { id: customId, kind: 'custom', label: nextCustom.title, enabled: true },
        ],
        custom_sections: [...current.custom_sections, nextCustom],
      };
    }, { history: 'immediate' });
    setSelectedSectionId(customId);
  }, [updateDraft]);

  const removeSection = useCallback(
    (sectionId: string) => {
      if (!draft) return;
      const section = draft.section_layout.find((entry) => entry.id === sectionId);
      if (!section || section.kind === 'identity') return;

      const label = section.label || section.kind;
      const isCustom = section.kind === 'custom';

      confirmDialog({
        title: isCustom ? 'Delete section' : 'Remove section',
        message: isCustom
          ? `Delete "${label}"? This cannot be undone.`
          : `Remove "${label}" from this resume? You can add it back with + Add section.`,
        destructive: true,
        onConfirm: () => {
          updateDraft((current) => {
            const target = current.section_layout.find((entry) => entry.id === sectionId);
            if (!target || target.kind === 'identity') return current;
            if (target.kind === 'custom') {
              return {
                ...current,
                section_layout: current.section_layout.filter((entry) => entry.id !== sectionId),
                custom_sections: current.custom_sections.filter((entry) => entry.id !== sectionId),
              };
            }
            return {
              ...current,
              section_layout: current.section_layout.map((entry) =>
                entry.id === sectionId ? { ...entry, enabled: false } : entry,
              ),
            };
          }, { history: 'immediate' });
          setSelectedSectionId((current) => (current === sectionId ? null : current));
        },
      });
    },
    [confirmDialog, draft, updateDraft],
  );

  const enableSection = useCallback(
    (sectionId: string) => {
      updateDraft(
        (current) => ({
          ...current,
          section_layout: current.section_layout.map((entry) =>
            entry.id === sectionId ? { ...entry, enabled: true } : entry,
          ),
        }),
        { history: 'immediate' },
      );
      setSelectedSectionId(sectionId);
    },
    [updateDraft],
  );

  const updateCustomSectionContent = useCallback(
    (sectionId: string, content: string) => {
      updateDraft((current) => ({
        ...current,
        custom_sections: current.custom_sections.map((section) =>
          section.id === sectionId ? { ...section, content } : section,
        ),
      }));
    },
    [updateDraft],
  );

  const persistDraft = useCallback(
    async ({ silent = false, draftName }: { silent?: boolean; draftName?: string } = {}): Promise<boolean> => {
      const current = draftRef.current;
      if (!current) return false;
      const trimmedName = (draftName ?? current.name ?? suggestDraftName(current)).trim();
      if (!trimmedName) {
        if (!silent) {
          const message = 'Draft name is required.';
          toast.error(message);
          announce(message);
        }
        return false;
      }
      try {
        if (!silent) setSaving(true);
        const response = await resumeBuilderApi.saveDraft(current.id, {
          name: trimmedName,
          profile: profileForPersistence(current.profile),
          section_layout: current.section_layout,
          custom_sections: current.custom_sections,
          target_resume_id: current.target_resume_id ?? null,
        });
        // Do NOT replace the live draft with the server's sanitized copy: it strips
        // in-progress entries (empty skill groups, half-typed bullets/highlights) and,
        // because the sanitized copy never equals the local draft, keeps `dirty` true —
        // which makes autosave fire on a loop and wipes what the user is typing.
        // Instead, sync only the name and mark the exact snapshot we saved as clean.
        let savedSnapshot = current;
        if (trimmedName !== current.name) {
          savedSnapshot = { ...current, name: trimmedName };
          setDraft((prev) => (prev ? { ...prev, name: trimmedName } : prev));
        }
        setSavedFingerprint(buildDraftFingerprint(savedSnapshot));
        setSavedDrafts((list) => [response.draft, ...list.filter((item) => item.id !== response.draft.id)]);
        if (!silent) {
          announce('Draft saved.');
          toast.success('Draft saved');
        }
        return true;
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Failed to save draft');
        }
        return false;
      } finally {
        if (!silent) setSaving(false);
      }
    },
    [announce, suggestDraftName],
  );

  const { saveState: autosaveState, flushAutosave, cancelAutosave } = useDraftAutosave({
    signal: draftFingerprint,
    dirty,
    enabled: Boolean(draft?.id) && !workspaceLoading,
    onSave: () => persistDraft({ silent: true }),
  });

  const saveState: SaveState = saving || autosaveState === 'saving' ? 'saving' : autosaveState;

  const saveCurrentDraft = useCallback(
    async (draftName?: string) => {
      if (!draftRef.current) return null;
      cancelAutosave();
      const ok = await persistDraft({ silent: false, draftName });
      return ok ? draftRef.current : null;
    },
    [cancelAutosave, persistDraft],
  );

  const openSaveDraftModal = useCallback(() => {
    if (!draft) return;
    setSaveDraftName(suggestDraftName(draft));
    setSaveDraftOpen(true);
  }, [draft, suggestDraftName]);

  const closeSaveDraftModal = useCallback(() => {
    if (saving) return;
    setSaveDraftOpen(false);
  }, [saving]);

  const confirmSaveDraft = useCallback(async (name?: string) => {
    const saved = await saveCurrentDraft((name ?? saveDraftName).trim());
    if (saved) {
      setSaveDraftOpen(false);
    }
  }, [saveCurrentDraft, saveDraftName]);

  const refreshLatex = useCallback(async () => {
    if (!draft) return;
    try {
      setLatexLoading(true);
      const saved = await flushAutosave();
      if (!saved) return;
      const response = await resumeBuilderApi.getLatex(draft.id);
      setLatex(response.tex);
      announce('LaTeX refreshed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load LaTeX');
    } finally {
      setLatexLoading(false);
    }
  }, [announce, draft, flushAutosave]);

  const refreshPreview = useCallback(async () => {
    if (!draft) return;
    try {
      setPreviewing(true);
      const saved = await flushAutosave();
      if (!saved) return;
      const response = await resumeBuilderApi.previewDraft(draft.id);
      cleanupPreviewUrl();
      setPreviewUrl(URL.createObjectURL(response.blob));
      setPageCount(response.pageCount);
      setPreviewStatus('ready');
      const latexResponse = await resumeBuilderApi.getLatex(draft.id);
      setLatex(latexResponse.tex);
      announce(`Preview refreshed. ${response.pageCount || 0} page${response.pageCount === 1 ? '' : 's'}.`);
    } catch (err) {
      setPreviewStatus('failed');
      toast.error(err instanceof Error ? err.message : 'Failed to preview draft');
    } finally {
      setPreviewing(false);
    }
  }, [announce, cleanupPreviewUrl, draft, flushAutosave]);

  const readiness = useMemo(() => {
    const base = computeBuilderReadiness({ draft, saveState, previewStatus, pageCount });
    if (!publishServerIssue) return base;
    if (base.blocking.some((issue) => issue.dimension === publishServerIssue.dimension)) return base;
    return {
      ...base,
      status: 'blocked' as const,
      blocking: [publishServerIssue, ...base.blocking],
    };
  }, [draft, pageCount, previewStatus, publishServerIssue, saveState]);

  const canPublish = readiness.blocking.length === 0;
  const overflowWarnings = useMemo(
    () => readiness.warnings.filter((issue) => issue.category === 'layout').map((issue) => issue.message),
    [readiness.warnings],
  );

  const openPublishModal = useCallback(() => {
    if (!draft) return;
    setPublishMode(draft.target_resume_id || draft.source_resume_id ? 'existing' : 'new');
    setPublishResumeName(buildDefaultResumeName(draft.profile));
    setPublishOpen(true);
  }, [draft]);

  const closePublishModal = useCallback(() => {
    setPublishOpen(false);
  }, []);

  const stayOnBuilder = useCallback(() => {
    setNavigationBlockOpen(false);
    setPendingNavigationHref(null);
  }, []);

  const leaveBuilder = useCallback(() => {
    const nextPath = pendingNavigationHref;
    setNavigationBlockOpen(false);
    setPendingNavigationHref(null);
    if (nextPath) {
      navigate(nextPath);
    }
  }, [navigate, pendingNavigationHref]);

  const publishCurrentDraft = useCallback(async (): Promise<PublishDraftResponse | null> => {
    if (!draft) return null;
    if (!canPublish) {
      const message = readiness.blocking[0]?.message || 'Resolve the blocking issues before publishing.';
      toast.error(message);
      announce(message);
      return null;
    }
    const targetResumeId = publishMode === 'existing' ? draft.target_resume_id || draft.source_resume_id || null : null;
    const trimmedResumeName = publishResumeName.trim();

    if (publishMode === 'new' && !trimmedResumeName) {
      const message = 'Enter a resume name before publishing.';
      toast.error(message);
      announce(message);
      return null;
    }

    try {
      setPublishing(true);
      setPublishServerIssue(null);
      const saved = await flushAutosave();
      if (!saved) return null;
      const response = await resumeBuilderApi.publishDraft(draft.id, {
        user_note: publishUserNote.trim(),
        target_resume_id: targetResumeId,
        resume_name: publishMode === 'new' ? trimmedResumeName : null,
        tags: splitValues(publishTags),
        set_active: publishSetActive,
      });
      cleanupPreviewUrl();
      historyRef.current.clear();
      setDraft(null);
      setSavedFingerprint(buildDraftFingerprint(null));
      setPreviewStatus('idle');
      setLatex('');
      setPageCount(0);
      setPublishOpen(false);
      announce('Resume published to Vault.');
      toast.success('Resume published to Vault');
      navigate(`/resume-vault/r/${response.resume_id}/${response.version_id}`);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish draft';
      if (err instanceof ResumeBuilderApiError) {
        const mappedIssue = mapPublishApiErrorToIssue(err);
        if (mappedIssue) setPublishServerIssue(mappedIssue);
      }
      toast.error(message);
      announce(message);
      return null;
    } finally {
      setPublishing(false);
    }
  }, [
    announce,
    cleanupPreviewUrl,
    canPublish,
    draft,
    flushAutosave,
    navigate,
    publishMode,
    publishResumeName,
    publishSetActive,
    publishTags,
    publishUserNote,
    readiness.blocking,
  ]);

  const undoDraft = useCallback(() => {
    const current = draftRef.current;
    if (!current) return;
    historyRef.current.pauseRecording();
    const snapshot = historyRef.current.undo(captureDraftSnapshot(current));
    if (snapshot) {
      updateDraft((draftState) => applyDraftSnapshot(draftState, snapshot), { history: 'skip' });
      announce('Undo.');
    }
    historyRef.current.resumeRecording();
  }, [announce, updateDraft]);

  const redoDraft = useCallback(() => {
    const current = draftRef.current;
    if (!current) return;
    historyRef.current.pauseRecording();
    const snapshot = historyRef.current.redo(captureDraftSnapshot(current));
    if (snapshot) {
      updateDraft((draftState) => applyDraftSnapshot(draftState, snapshot), { history: 'skip' });
      announce('Redo.');
    }
    historyRef.current.resumeRecording();
  }, [announce, updateDraft]);

  useEffect(() => {
    if (!draft || workspaceLoading) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoDraft();
        return;
      }

      if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
        event.preventDefault();
        redoDraft();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [draft, redoDraft, undoDraft, workspaceLoading]);

  const deleteCurrentDraft = useCallback(async () => {
    if (!draft) return;
    confirmDialog({
      title: 'Delete Draft',
      message: 'This draft cannot be recovered after deletion.',
      destructive: true,
      onConfirm: async () => {
        try {
          await resumeBuilderApi.deleteDraft(draft.id);
          cleanupPreviewUrl();
          historyRef.current.clear();
          setDraft(null);
          setSavedFingerprint(buildDraftFingerprint(null));
          setPreviewStatus('idle');
          setLatex('');
          setPageCount(0);
          announce('Draft deleted.');
          navigate('/resume-vault/builder', { replace: true });
          toast.success('Draft deleted');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete draft');
        }
      },
    });
  }, [announce, cleanupPreviewUrl, confirmDialog, draft, navigate]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === (draft?.template_id || selectedTemplateId)) ?? null,
    [draft?.template_id, selectedTemplateId, templates],
  );

  return {
    focusRingClass: FOCUS_RING_CLASS,
    builderEnabled: BUILDER_ENABLED,
    catalogLoading,
    workspaceLoading,
    previewsLoading,
    /** True while catalog or workspace data is still loading. */
    loading: catalogLoading || workspaceLoading,
    saving,
    previewing,
    latexLoading,
    publishing,
    error,
    templates,
    activeTemplate,
    draft,
    savedDrafts,
    profileIdentity,
    profileReady,
    previewUrl,
    previewStatus,
    pageCount,
    latex,
    dirty,
    saveState,
    readiness,
    canPublish,
    statusMessage,
    overflowWarnings,
    selectedSectionId,
    selectedTemplateId,
    publishOpen,
    publishMode,
    publishResumeName,
    publishUserNote,
    publishTags,
    publishSetActive,
    navigationBlockOpen,
    hasExistingPublishTarget,
    templatePreviewUrls,
    saveDraftOpen,
    saveDraftName,
    setSelectedSectionId,
    setSelectedTemplateId,
    setPublishMode,
    setPublishResumeName,
    setPublishUserNote,
    setPublishTags,
    setPublishSetActive,
    createDraft,
    openDraft,
    setProfileName,
    setProfileEmail,
    setProfilePhone,
    setProfileLocation,
    setProfileLinks,
    setProfileOtherLinks,
    setSummary,
    addWorkExperience,
    setWorkExperienceItem,
    removeWorkExperience,
    addEducation,
    setEducationItem,
    removeEducation,
    addEducationHighlight,
    setEducationHighlight,
    removeEducationHighlight,
    addSkillGroup,
    setSkillGroup,
    removeSkillGroup,
    addProject,
    setProjectItem,
    removeProject,
    addAchievement,
    setAchievementItem,
    removeAchievement,
    addPublication,
    setPublicationItem,
    removePublication,
    renameSection,
    reorderSection,
    addCustomSection,
    removeSection,
    enableSection,
    updateCustomSectionContent,
    undoDraft,
    redoDraft,
    canUndo: draftHistory.canUndo,
    canRedo: draftHistory.canRedo,
    openSaveDraftModal,
    closeSaveDraftModal,
    confirmSaveDraft,
    refreshPreview,
    refreshLatex,
    openPublishModal,
    closePublishModal,
    stayOnBuilder,
    leaveBuilder,
    publishCurrentDraft,
    deleteCurrentDraft,
  };
}

