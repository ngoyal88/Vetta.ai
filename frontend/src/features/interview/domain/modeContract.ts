/**
 * Interview mode SSOT — must stay aligned with backend registry.py LIVE_STARTABLE_TYPES.
 * Catalog slug (UI) vs apiType (session/history/API) are explicit per row.
 */

export const AI_INTERVIEW_HUB_PATH = "/ai-interview";
export const AI_INTERVIEW_HISTORY_PATH = "/ai-interview/history";
export const AI_INTERVIEW_ANALYTICS_PATH = "/ai-interview/analytics";

/** UI / catalog slug (routes, hub cards). */
export type ModeSlug =
  | "role_targeted"
  | "resume_deep_dive"
  | "pair_programming"
  | "pressure"
  | "blind";

/** Session storage, history, and POST /interview/start interview_type. */
export type InterviewApiType =
  | "role_targeted"
  | "resume"
  | "pair_programming"
  | "pressure"
  | "blind";

export type ModeDefinition = {
  catalogSlug: ModeSlug | null;
  apiType: InterviewApiType;
  route: string | null;
  title: string;
  historyLabel: string;
  comingSoon: boolean;
  liveStartable: boolean;
  supportsCoding: boolean;
  supportsReplay: boolean;
  historyFilter: boolean;
  requiresResume: boolean;
};

const ROUTES = {
  role_targeted: "/ai-interview/role-targeted",
  resume_deep_dive: "/ai-interview/resume-deep-dive",
  pair_programming: "/ai-interview/pair-programming",
  pressure: "/ai-interview/pressure-mode",
  blind: "/ai-interview/blind-mode",
} as const;

export const MODE_DEFINITIONS: readonly ModeDefinition[] = [
  {
    catalogSlug: "role_targeted",
    apiType: "role_targeted",
    route: ROUTES.role_targeted,
    title: "Role-Targeted",
    historyLabel: "Role-Targeted Interview",
    comingSoon: false,
    liveStartable: true,
    supportsCoding: false,
    supportsReplay: true,
    historyFilter: true,
    requiresResume: false,
  },
  {
    catalogSlug: "resume_deep_dive",
    apiType: "resume",
    route: ROUTES.resume_deep_dive,
    title: "Resume Deep-Dive",
    historyLabel: "Resume Deep-Dive",
    comingSoon: false,
    liveStartable: true,
    supportsCoding: false,
    supportsReplay: true,
    historyFilter: true,
    requiresResume: true,
  },
  {
    catalogSlug: "pair_programming",
    apiType: "pair_programming",
    route: ROUTES.pair_programming,
    title: "Pair Programming",
    historyLabel: "Pair Programming",
    comingSoon: false,
    liveStartable: true,
    supportsCoding: true,
    supportsReplay: true,
    historyFilter: true,
    requiresResume: false,
  },
  {
    catalogSlug: "pressure",
    apiType: "pressure",
    route: ROUTES.pressure,
    title: "Pressure Cooker",
    historyLabel: "Pressure Mode",
    comingSoon: true,
    liveStartable: false,
    supportsCoding: false,
    supportsReplay: false,
    historyFilter: false,
    requiresResume: false,
  },
  {
    catalogSlug: "blind",
    apiType: "blind",
    route: ROUTES.blind,
    title: "Blind Audition",
    historyLabel: "Blind Mode",
    comingSoon: true,
    liveStartable: false,
    supportsCoding: false,
    supportsReplay: false,
    historyFilter: false,
    requiresResume: false,
  },
] as const;

export const MODE_ROUTE_BY_SLUG: Record<ModeSlug, string> = {
  role_targeted: ROUTES.role_targeted,
  resume_deep_dive: ROUTES.resume_deep_dive,
  pair_programming: ROUTES.pair_programming,
  pressure: ROUTES.pressure,
  blind: ROUTES.blind,
};

export const LIVE_STARTABLE_INTERVIEW_TYPES = MODE_DEFINITIONS.filter((m) => m.liveStartable).map(
  (m) => m.apiType,
) as readonly InterviewApiType[];

export type LiveStartableInterviewType = (typeof LIVE_STARTABLE_INTERVIEW_TYPES)[number];

export const HISTORY_FILTER_API_TYPES = MODE_DEFINITIONS.filter((m) => m.historyFilter).map(
  (m) => m.apiType,
) as readonly InterviewApiType[];

export type HistoryFilterApiType = (typeof HISTORY_FILTER_API_TYPES)[number];

export type HistoryFilterTab = "all" | HistoryFilterApiType;

const byApiType = new Map(MODE_DEFINITIONS.map((m) => [m.apiType, m]));
const byCatalogSlug = new Map(
  MODE_DEFINITIONS.filter((m) => m.catalogSlug != null).map((m) => [m.catalogSlug!, m]),
);

export function getModeByApiType(apiType: string | null | undefined): ModeDefinition | undefined {
  const key = (apiType || "").toLowerCase() as InterviewApiType;
  return byApiType.get(key);
}

export function getModeByCatalogSlug(slug: ModeSlug): ModeDefinition | undefined {
  return byCatalogSlug.get(slug);
}

export function getModeRoute(slug: ModeSlug): string {
  return MODE_ROUTE_BY_SLUG[slug];
}

export function getModeLabel(storedType?: string | null): string {
  const mode = getModeByApiType(storedType);
  if (mode) return mode.historyLabel;
  if ((storedType || "").toLowerCase() === "resume_deep_dive") {
    return getModeByApiType("resume")?.historyLabel ?? "Resume Deep-Dive";
  }
  return "Interview session";
}

export function apiTypeFromCatalogSlug(slug: ModeSlug): InterviewApiType {
  const mode = getModeByCatalogSlug(slug);
  return mode?.apiType ?? "role_targeted";
}

export function isLiveStartableInterviewType(type: string | null | undefined): boolean {
  const mode = getModeByApiType(type);
  return mode?.liveStartable ?? false;
}

export function supportsReplay(type: string | null | undefined): boolean {
  const mode = getModeByApiType(type);
  return mode?.supportsReplay ?? false;
}

export function isCodingSession(storedType: string | null | undefined): boolean {
  const mode = getModeByApiType(storedType);
  if (mode) return mode.supportsCoding;
  return (storedType || "").toLowerCase() === "pair_programming";
}

export function isCodingPhase(phase: string | null | undefined): boolean {
  const p = (phase || "").toLowerCase();
  // "dsa" accepted as wire alias for coding-phase messages from agent/WS.
  return p === "coding" || p === "dsa";
}

export function getCatalogModes(): ModeDefinition[] {
  return MODE_DEFINITIONS.filter((m) => m.catalogSlug != null);
}

export function getActiveCatalogModes(): ModeDefinition[] {
  return getCatalogModes().filter((m) => !m.comingSoon);
}

export function getComingSoonCatalogModes(): ModeDefinition[] {
  return getCatalogModes().filter((m) => m.comingSoon);
}

/** Setup routes for app router registration. */
export const MODE_SETUP_ROUTES: { path: string; catalogSlug: ModeSlug }[] = (
  Object.entries(MODE_ROUTE_BY_SLUG) as [ModeSlug, string][]
).map(([catalogSlug, path]) => ({ path, catalogSlug }));

export type QuickLaunchAccent = "primary" | "secondary" | "tertiary";

export type QuickLaunchDef = {
  catalogSlug: ModeSlug;
  title: string;
  description: string;
  accent: QuickLaunchAccent;
  href: string;
  badge?: string;
  status: "active" | "soon";
  requiresResume?: boolean;
};

export const QUICK_LAUNCH_MODES: QuickLaunchDef[] = [
  {
    catalogSlug: "role_targeted",
    title: "Role-Targeted",
    description: "Simulate interviews tailored to your saved job descriptions.",
    accent: "primary",
    href: ROUTES.role_targeted,
    badge: "Recommended",
    status: "active",
  },
  {
    catalogSlug: "resume_deep_dive",
    title: "Resume Deep-Dive",
    description: "Defend your experience point-by-point against AI scrutiny.",
    accent: "secondary",
    href: ROUTES.resume_deep_dive,
    status: "active",
    requiresResume: true,
  },
  {
    catalogSlug: "pressure",
    title: "Pressure Testing",
    description: "Stress test decisions with timed constraints and curveballs.",
    accent: "tertiary",
    href: ROUTES.pressure,
    status: "soon",
  },
  {
    catalogSlug: "pair_programming",
    title: "Pair Programming AI",
    description: "Collaborate on live coding sessions with real-time feedback.",
    accent: "tertiary",
    href: ROUTES.pair_programming,
    status: "active",
  },
];

export const HISTORY_FILTER_TABS: { id: HistoryFilterTab; label: string }[] = [
  { id: "all", label: "All" },
  ...HISTORY_FILTER_API_TYPES.map((apiType) => {
    const mode = getModeByApiType(apiType)!;
    return {
      id: apiType as HistoryFilterTab,
      label: mode.title,
    };
  }),
];
