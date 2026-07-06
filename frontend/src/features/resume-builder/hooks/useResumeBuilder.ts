import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { getDraftDisplayName, nextResumeDraftName } from '../utils/draftNames';
import { resumeBuilderApi } from '../services/resumeBuilderApi';
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

  const dirty = useMemo(() => buildDraftFingerprint(draft) !== savedFingerprint, [draft, savedFingerprint]);
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

  const applyDraftState = useCallback(
    (nextDraft: ResumeBuilderDraft, { replaceRoute = true }: { replaceRoute?: boolean } = {}) => {
      setDraft(nextDraft);
      setSavedFingerprint(buildDraftFingerprint(nextDraft));
      setSelectedTemplateId(nextDraft.template_id);
      setSelectedSectionId(null);
      setPublishMode(nextDraft.target_resume_id || nextDraft.source_resume_id ? 'existing' : 'new');
      setPublishResumeName(buildDefaultResumeName(nextDraft.profile));
      setPublishUserNote('');
      setPublishTags('');
      setPublishSetActive(true);
      if (replaceRoute) {
        navigate(`/resume-vault/builder/${nextDraft.id}`, { replace: true });
      }
    },
    [navigate],
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
        applyDraftState(nextDraft, { replaceRoute: false });
        const latexResponse = await resumeBuilderApi.getLatex(targetDraftId);
        setLatex(latexResponse.tex);
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
      setSavedDrafts((current) => [response.draft, ...current.filter((item) => item.id !== response.draft.id)]);
      setLatex('');
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

  const setDraftProfile = useCallback((updater: (profile: ResumeProfile) => ResumeProfile) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, profile: updater(cloneProfile(current.profile)) };
    });
  }, []);

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
    setDraftProfile((profile) => ({
      ...profile,
      work_experience: [...(profile.work_experience || []), createWorkExperienceItem()],
    }));
  }, [setDraftProfile]);

  const setWorkExperienceItem = useCallback((index: number, item: ResumeWorkExperienceItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      work_experience: replaceSectionItems(profile.work_experience, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeWorkExperience = useCallback((index: number) => {
    setDraftProfile((profile) => ({
      ...profile,
      work_experience: (profile.work_experience || []).filter((_, currentIndex) => currentIndex !== index),
    }));
  }, [setDraftProfile]);

  const addEducation = useCallback(() => {
    setDraftProfile((profile) => ({
      ...profile,
      education: [...(profile.education || []), createEducationItem()],
    }));
  }, [setDraftProfile]);

  const setEducationItem = useCallback((index: number, item: ResumeEducationRecord) => {
    setDraftProfile((profile) => ({
      ...profile,
      education: replaceSectionItems(profile.education, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeEducation = useCallback((index: number) => {
    setDraftProfile((profile) => ({
      ...profile,
      education: (profile.education || []).filter((_, currentIndex) => currentIndex !== index),
    }));
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
    });
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
    });
  }, [setDraftProfile]);

  const setSkillGroup = useCallback((index: number, group: BuilderSkillGroup) => {
    setDraftProfile((profile) => {
      const skills = [...ensureBuilderSkillGroups(profile.skills)];
      skills[index] = group;
      return { ...profile, skills };
    });
  }, [setDraftProfile]);

  const addSkillGroup = useCallback(() => {
    setDraftProfile((profile) => ({
      ...profile,
      skills: [...ensureBuilderSkillGroups(profile.skills), createEmptySkillGroup()],
    }));
  }, [setDraftProfile]);

  const removeSkillGroup = useCallback((index: number) => {
    setDraftProfile((profile) => ({
      ...profile,
      skills: ensureBuilderSkillGroups(profile.skills).filter((_, currentIndex) => currentIndex !== index),
    }));
  }, [setDraftProfile]);

  const addProject = useCallback(() => {
    setDraftProfile((profile) => ({
      ...profile,
      projects: [...(profile.projects || []), createProjectItem()],
    }));
  }, [setDraftProfile]);

  const setProjectItem = useCallback((index: number, item: ResumeProjectItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      projects: replaceSectionItems(profile.projects, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeProject = useCallback((index: number) => {
    setDraftProfile((profile) => ({
      ...profile,
      projects: (profile.projects || []).filter((_, currentIndex) => currentIndex !== index),
    }));
  }, [setDraftProfile]);

  const addAchievement = useCallback(() => {
    setDraftProfile((profile) => ({
      ...profile,
      achievements: [...(profile.achievements || []), createAchievementItem()],
    }));
  }, [setDraftProfile]);

  const setAchievementItem = useCallback((index: number, item: ResumeAchievementItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      achievements: replaceSectionItems(profile.achievements, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removeAchievement = useCallback((index: number) => {
    setDraftProfile((profile) => ({
      ...profile,
      achievements: (profile.achievements || []).filter((_, currentIndex) => currentIndex !== index),
    }));
  }, [setDraftProfile]);

  const addPublication = useCallback(() => {
    setDraftProfile((profile) => ({
      ...profile,
      publications: [...(profile.publications || []), createPublicationItem()],
    }));
  }, [setDraftProfile]);

  const setPublicationItem = useCallback((index: number, item: ResumePublicationItem) => {
    setDraftProfile((profile) => ({
      ...profile,
      publications: replaceSectionItems(profile.publications, index, item),
    }));
  }, [replaceSectionItems, setDraftProfile]);

  const removePublication = useCallback((index: number) => {
    setDraftProfile((profile) => ({
      ...profile,
      publications: (profile.publications || []).filter((_, currentIndex) => currentIndex !== index),
    }));
  }, [setDraftProfile]);

  const renameSection = useCallback((sectionId: string, label: string) => {
    setDraft((current) => {
      if (!current) return current;
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
    });
  }, []);

  const reorderSection = useCallback((fromId: string, toId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const fromIndex = current.section_layout.findIndex((section) => section.id === fromId);
      const toIndex = current.section_layout.findIndex((section) => section.id === toId);
      if (fromIndex <= 0 || toIndex <= 0 || fromIndex === -1 || toIndex === -1) return current;
      const updated = [...current.section_layout];
      const [item] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, item);
      return { ...current, section_layout: updated };
    });
  }, []);

  const addCustomSection = useCallback(() => {
    const customId = `custom_${Date.now()}`;
    setDraft((current) => {
      if (!current) return current;
      const nextCustom: BuilderCustomSection = { id: customId, title: 'New Section', content: '' };
      return {
        ...current,
        section_layout: [
          ...current.section_layout,
          { id: customId, kind: 'custom', label: nextCustom.title, enabled: true },
        ],
        custom_sections: [...current.custom_sections, nextCustom],
      };
    });
    setSelectedSectionId(customId);
  }, []);

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
          setDraft((current) => {
            if (!current) return current;
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
          });
          setSelectedSectionId((current) => (current === sectionId ? null : current));
        },
      });
    },
    [confirmDialog, draft],
  );

  const enableSection = useCallback((sectionId: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        section_layout: current.section_layout.map((entry) =>
          entry.id === sectionId ? { ...entry, enabled: true } : entry,
        ),
      };
    });
    setSelectedSectionId(sectionId);
  }, []);

  const updateCustomSectionContent = useCallback((sectionId: string, content: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        custom_sections: current.custom_sections.map((section) =>
          section.id === sectionId ? { ...section, content } : section,
        ),
      };
    });
  }, []);

  const saveCurrentDraft = useCallback(async (draftName?: string) => {
    if (!draft) return null;
    const trimmedName = (draftName ?? draft.name ?? suggestDraftName(draft)).trim();
    if (!trimmedName) {
      const message = 'Draft name is required.';
      toast.error(message);
      announce(message);
      return null;
    }
    try {
      setSaving(true);
      const response = await resumeBuilderApi.saveDraft(draft.id, {
        name: trimmedName,
        profile: profileForPersistence(draft.profile),
        section_layout: draft.section_layout,
        custom_sections: draft.custom_sections,
        target_resume_id: draft.target_resume_id ?? null,
      });
      applyDraftState(response.draft, { replaceRoute: false });
      setSavedDrafts((current) => [response.draft, ...current.filter((item) => item.id !== response.draft.id)]);
      announce('Draft saved.');
      toast.success('Draft saved');
      return response.draft;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
      return null;
    } finally {
      setSaving(false);
    }
  }, [announce, applyDraftState, draft, suggestDraftName]);

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
      if (dirty) {
        const saved = await saveCurrentDraft();
        if (!saved) return;
      }
      const response = await resumeBuilderApi.getLatex(draft.id);
      setLatex(response.tex);
      announce('LaTeX refreshed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load LaTeX');
    } finally {
      setLatexLoading(false);
    }
  }, [announce, dirty, draft, saveCurrentDraft]);

  const refreshPreview = useCallback(async () => {
    if (!draft) return;
    try {
      setPreviewing(true);
      if (dirty) {
        const saved = await saveCurrentDraft();
        if (!saved) return;
      }
      const response = await resumeBuilderApi.previewDraft(draft.id);
      cleanupPreviewUrl();
      setPreviewUrl(URL.createObjectURL(response.blob));
      setPageCount(response.pageCount);
      const latexResponse = await resumeBuilderApi.getLatex(draft.id);
      setLatex(latexResponse.tex);
      announce(`Preview refreshed. ${response.pageCount || 0} page${response.pageCount === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to preview draft');
    } finally {
      setPreviewing(false);
    }
  }, [announce, cleanupPreviewUrl, dirty, draft, saveCurrentDraft]);

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
      if (dirty) {
        const saved = await saveCurrentDraft();
        if (!saved) return null;
      }
      const response = await resumeBuilderApi.publishDraft(draft.id, {
        user_note: publishUserNote.trim(),
        target_resume_id: targetResumeId,
        resume_name: publishMode === 'new' ? trimmedResumeName : null,
        tags: splitValues(publishTags),
        set_active: publishSetActive,
      });
      cleanupPreviewUrl();
      setDraft(null);
      setSavedFingerprint(buildDraftFingerprint(null));
      setLatex('');
      setPageCount(0);
      setPublishOpen(false);
      announce('Resume published to Vault.');
      toast.success('Resume published to Vault');
      navigate(`/resume-vault/r/${response.resume_id}/${response.version_id}`);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish draft';
      toast.error(message);
      announce(message);
      return null;
    } finally {
      setPublishing(false);
    }
  }, [
    announce,
    cleanupPreviewUrl,
    dirty,
    draft,
    navigate,
    publishMode,
    publishResumeName,
    publishSetActive,
    publishTags,
    publishUserNote,
    saveCurrentDraft,
  ]);

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
          setDraft(null);
          setSavedFingerprint(buildDraftFingerprint(null));
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

  const overflowWarnings = useMemo(() => {
    if (!draft) return [];
    const warnings: string[] = [];
    if ((draft.profile.summary || '').trim().length > 500) {
      warnings.push('Summary is getting long. Consider tightening it before publishing.');
    }
    const longCustom = draft.custom_sections.find((section) => section.content.trim().length > 900);
    if (longCustom) {
      warnings.push(`"${longCustom.title}" may overflow the template. Shorten or split the content.`);
    }
    const bulkyExperience = (draft.profile.work_experience || []).find(
      (item) => (item.responsibilities || []).length + (item.impact || []).length > 7,
    );
    if (bulkyExperience) {
      warnings.push('One experience entry has many bullet points. The PDF may become hard to scan.');
    }
    return warnings;
  }, [draft]);

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
    pageCount,
    latex,
    dirty,
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

