/**
 * Interview mode catalog — copy aligned with docs/product.md (Session Types).
 * Routes match App.jsx PrivateRoute entries under /modes/*
 */

export type ModeSlug =
  | "role_targeted"
  | "pressure"
  | "resume_deep_dive"
  | "blind"
  | "pair_programming";

export type ModeCardDefinition = {
  slug: ModeSlug;
  path: string;
  /** Lucide icon component name */
  iconName: "Target" | "Flame" | "FileSearch" | "Dice5" | "Users";
  title: string;
  /** Mono caption — teal accent per frontend.md */
  tagline: string;
  /** Body copy from product vision */
  summary: string;
  highlights: [string, string];
  /** Still navigating to setup; surface “coming soon” on card until backend parity */
  comingSoon: boolean;
};

export const MODE_ROUTE_BY_SLUG: Record<ModeSlug, string> = {
  role_targeted: "/modes/role-targeted",
  pressure: "/modes/pressure-mode",
  resume_deep_dive: "/modes/resume-deep-dive",
  blind: "/modes/blind-mode",
  pair_programming: "/modes/pair-programming",
};

export const MODE_CARDS: ModeCardDefinition[] = [
  {
    slug: "role_targeted",
    path: MODE_ROUTE_BY_SLUG.role_targeted,
    iconName: "Target",
    title: "Role-targeted",
    tagline: "Company · role · seniority",
    summary:
      "Describe the job you are preparing for—not just “backend,” but backend at a given archetype with the right bar and focus areas. The session follows that lens so questions emphasize the systems and tradeoffs that interview loop actually cares about.",
    highlights: [
      "Questions weighted toward the stack and failure modes that matter for that seat.",
      "Calibrated difficulty so follow-ups feel like a real loop, not a generic rubric.",
    ],
    comingSoon: false,
  },
  {
    slug: "pressure",
    path: MODE_ROUTE_BY_SLUG.pressure,
    iconName: "Flame",
    title: "Pressure mode",
    tagline: "Worst-day interviewer",
    summary:
      "Less patience, fewer hints, faster pivots—so you calibrate for the tail risk: the tired panelist, the rapid follow-up, the moment you have to recover without a prompt.",
    highlights: [
      "Shorter runway before the conversation moves on.",
      "Useful when the real loop already feels easy—this makes the real day feel slower.",
    ],
    comingSoon: true,
  },
  {
    slug: "resume_deep_dive",
    path: MODE_ROUTE_BY_SLUG.resume_deep_dive,
    iconName: "FileSearch",
    title: "Resume deep-dive",
    tagline: "Your history on the record",
    summary:
      "The AI works from your résumé and spends the session probing decisions, tradeoffs, and impact—the behavioral depth many candidates skip and many hiring managers weight heavily.",
    highlights: [
      "Follow-ups chase specificity: metrics, constraints, what you would do differently.",
      "Best when you want reps explaining real projects under scrutiny.",
    ],
    comingSoon: true,
  },
  {
    slug: "blind",
    path: MODE_ROUTE_BY_SLUG.blind,
    iconName: "Dice5",
    title: "Blind mode",
    tagline: "Cold start · target pool",
    summary:
      "No résumé signal up front—question mix drawn from a target-style pool so it mirrors walking into the room without warm context. Closest to a cold technical loop.",
    highlights: [
      "Forces structured thinking without leaning on projects you already named.",
      "Pairs well once role-targeted and deep-dive reps feel comfortable.",
    ],
    comingSoon: true,
  },
  {
    slug: "pair_programming",
    path: MODE_ROUTE_BY_SLUG.pair_programming,
    iconName: "Users",
    title: "Pair programming",
    tagline: "Observe · debrief",
    summary:
      "Designed for two-person practice: a colleague joins as observer, sees interviewer-facing signal, and can debrief after—so teams rehearse together instead of in isolation.",
    highlights: [
      "Observer sees evaluation framing in near–real time.",
      "Built for squad preparation, not solo drills only.",
    ],
    comingSoon: true,
  },
];

/** Legacy shape for any remaining imports */
export const ADVANCED_INTERVIEW_TYPES = MODE_CARDS.map((m) => ({
  value: m.slug,
  label: m.title,
  icon: "",
  desc: m.tagline,
}));
