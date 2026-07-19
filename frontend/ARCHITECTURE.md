# Frontend architecture

Vetta.ai's React app splits **public marketing** from the **authenticated product**. Use this guide when adding pages, routes, or shared UI.

## Top-level layout

| Area | Path | Purpose |
|------|------|---------|
| Public site | `src/features/website/` | Home, pricing, contact, 404 — `WebsiteLayout`, no `AppShell` |
| App features | `src/features/<domain>/` | Dashboard, vault, modes, interview, signal, auth |
| Cross-cutting | `src/shared/` | Auth, HTTP client, guards, `AppShell`, `ui/` primitives |
| Route registry | `src/routes/` + `App.tsx` | Composed route modules |

## Where does a new page go?

```
Is it public (no login, marketing/legal)?
  → features/website/pages/
     Use WebsiteLayout. Register in routes/websiteRoutes.tsx.

Is it sign-in / sign-up?
  → features/auth/pages/
     Register in routes/authRoutes.tsx with GuestRoute.

Is it behind login?
  → features/<domain>/pages/
     Wrap with PrivateRoute + AppShell in routes/appRoutes.tsx.
```

Do **not** add marketing pages under `shared/pages/`.

## Routing

- `App.tsx` composes: `websiteRoutes`, `authRoutes`, `appRoutes`, `legacyRedirects`, catch-all `NotFoundPage`.
- Legacy `/modes/*` paths redirect in `legacyRedirects.tsx`.
- Interview room lazy-loads from `features/interview/session/InterviewRoom`.

## Interview modes (SSOT)

| Concern | Location |
|---------|----------|
| Slug, API type, routes, flags | `features/interview/domain/modeContract.ts` |
| Pair-programming tracks | `features/interview/domain/tracks.ts` |
| Cross-stack doc | `docs/INTERVIEW_MODE_CONTRACT.md` |
| Grid copy, icons, marketing | `features/modes/catalog/modeCatalog.ts` (derives from contract) |
| Mode-specific setup | `features/modes/<mode>/` |

Import mode knowledge from `features/interview` (barrel) or `domain/modeContract` — never duplicate route/label literals.

## Interview feature layout

```
features/interview/
  domain/           # modeContract, tracks
  services/         # interviewApi, livekitApi, profileClaimsApi, …
  session/          # InterviewRoom, Shell, transport hooks, overlays
  room/             # Voice/Coding stages, HUD, dock, orb
  coding/           # CodeEditor, problem panel, Monaco theme
  preflight/        # PreSessionChecker, mic/camera utils
  report/           # SessionReport, claims review
  index.ts          # public exports for other features
```

Other features import from `features/interview` barrel only — not `session/hooks/*` internals.

## Design system

Tokens live in `src/index.css` and `.cursor/rules/DESIGN.md`. Use CSS variables and Tailwind mappings — no hardcoded hex in components.

Shared primitives: `shared/ui/` (`Modal`, `Chip`, `SectionLabel`, `EmptyState`). Legacy `shared/components/Modal` re-exports from `shared/ui`.

## API and auth

- HTTP transport: `shared/services/httpClient.ts` (`authenticatedFetch`, `authenticatedJson`).
- Feature endpoints: `features/interview/services/*Api.ts` (and other `features/*/services/*Api.ts`).
- Deprecated barrel: `shared/services/api.ts` re-exports interview services — prefer direct feature imports for new code.
- Auth state: `useAuth()` from `shared/context/AuthContext.tsx`.

## Import boundaries

Run `npm run check:imports` before PRs. Rules (enforced by `scripts/check-imports.mjs`):

- `shared/*` must not import `features/*`.
- `features/A` must not import `features/B/**` internals (use `features/B` barrel when exported).
- Cross-feature exceptions are allowlisted in the script until barrels cover them.

Also run `npm run check:no-js` — no new `.js`/`.jsx` under `src/`.

## Feature folder shape

Each domain under `features/<domain>/` should follow the same skeleton when the concern exists:

```
features/<domain>/
  pages/           # route entry components
  components/      # presentational + feature UI
  hooks/           # stateful logic
  utils/           # pure helpers
  services/        # API wrappers (*Api.ts)
  types/           # TypeScript types
  *.css            # feature-scoped styles (import from layout or pages)
```

Mode-specific setup lives under `features/modes/<mode-slug>/`. Shared mode UI goes in `features/modes/shared/`.

## Tests

### Layers

| Layer | Location | Notes |
|-------|----------|-------|
| Unit | `**/__tests__/` beside source | Pure helpers, hooks, reducers |
| Service contract | `features/*/services/__tests__/` | Mock `httpClient` / `fetch`; assert URL + body |
| Component smoke | `components/__tests__/` | Render + key interactions |
| E2E (scaffold) | `frontend/e2e/` | Playwright; set `PLAYWRIGHT_E2E_ENABLED=1` locally |

Global setup: `src/test/setup.ts`. Vitest include: `src/**/__tests__/**/*.{test,spec}.{ts,tsx}`.

**Do not co-locate `*.test.ts(x)` next to source files.**

Naming: mirror the module under test (`codeEditorUtils.ts` → `__tests__/codeEditorUtils.test.ts`).

Mode contract sync: FE `domain/__tests__/modeContract.test.ts` + backend `tests/test_mode_registry.py` must stay aligned with `docs/INTERVIEW_MODE_CONTRACT.md`.
