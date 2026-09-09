# 🎯 Vetta.ai — AI Interview Platform

Vetta.ai is a full-stack interview preparation platform with a React + Vite frontend and a FastAPI backend. It combines AI-powered interview sessions, resume analysis, application-fit scoring, a resume vault/builder, and optional job discovery features into one product for candidates preparing for technical roles.

## What this project does

Vetta.ai helps candidates:

- practice interviews in multiple modes such as role-targeted, pressure mode, resume deep dive, blind mode, and pair programming
- upload and manage resumes in a vault with versioning and comparison tools
- evaluate their fit for a job description with application-fit scoring and history
- explore job discovery and saved jobs when enabled
- manage profile, account, and career preference data
- use authentication-protected pages, realtime interview flows, and backend health checks

The app is designed as a modular product: the frontend routes expose different candidate workflows, while the backend coordinates interview sessions, AI providers, auth, storage, and optional services like LiveKit and resume compilation.

## Tech stack

### Frontend
- **React 19**
- **TypeScript**
- **Vite**
- **React Router DOM 7**
- **React Query**
- **Firebase client SDK**
- **Framer Motion**
- **React Hot Toast**
- **Sentry React**
- **Monaco Editor**
- **Tailwind CSS**
- **Playwright** for end-to-end tests
- **Vitest** for unit/integration testing

### Backend
- **Python 3.11**
- **FastAPI**
- **Uvicorn**
- **Pydantic / Pydantic Settings**
- **Redis**
- **Firebase Admin SDK**
- **Supabase**
- **Meilisearch**
- **LiveKit Agents**
- **Google Generative AI / Groq**
- **Deepgram**
- **ElevenLabs**
- **Edge TTS**
- **Judge0** integration
- **Sentry SDK**
- **PyMuPDF / PyPDF2 / python-docx** for resume parsing
- **pytest** / **pytest-asyncio** for tests

### Infrastructure and tooling
- **Docker**
- **Docker Compose**
- **Firebase**
- **Typst** for the resume compile service
- **Apify** support for LinkedIn/job discovery ingestion

## Repository layout

```text
backend/                 FastAPI API, services, routes, auth, storage, AI integrations
frontend/                React app, feature modules, route definitions, UI and tests
docker-compose.yml       Local multi-service orchestration
.env.example             Root backend/runtime environment template
frontend/.env.example    Vite frontend environment template
firebase.json            Firebase hosting / project configuration
firestore.indexes.json   Firestore index definitions
product.md               Product brief and aspirational roadmap
```

### Backend structure

```text
backend/
  main.py                FastAPI app, CORS, lifespan, health checks, router wiring
  config.py              Pydantic settings and env handling
  Dockerfile             Python container image
  requirements.txt       Python dependencies
  run_livekit_agent.py   LiveKit agent worker entrypoint
  run_compile_service.py Resume compile service entrypoint (Typst)
  firebase_config.py     Firebase initialization
  routes/                API routers for app features
  services/              Business logic and integrations
  utils/                 Logging, Redis, auth, error helpers, CORS utilities
  models/                Pydantic models
  templates/             Resume builder templates and LaTeX assets
  data/                  Runtime/local data storage
  bin/                   Supporting scripts/utilities
```

### Frontend structure

```text
frontend/
  src/
    index.tsx            React root, providers, Sentry init
    App.tsx              App shell, route composition, toast host
    firebaseConfig.ts    Firebase client config
    routes/              Route definitions and legacy redirects
    features/            Product areas organized by domain
    shared/              Shared UI, hooks, layout, services, styles, utils
    test/                Frontend test utilities
  vite.config.ts         Vite config, aliases, build chunking
  tsconfig.json          TypeScript configuration and path aliases
  package.json           Frontend scripts and dependencies
```

## Main product areas

### Website and marketing pages
The public site is defined in `frontend/src/routes/websiteRoutes.tsx` and includes:
- `/` home page
- `/contact`
- `/pricing`
- redirects for `/docs`, `/privacy`, and `/terminal`

### Authentication
`frontend/src/routes/authRoutes.tsx` defines:
- `/signin`
- `/signup`
- `/verify-email`

These routes are wrapped with guest/auth guards from shared components.

### Authenticated app experience
`frontend/src/routes/appRoutes.tsx` defines the main app shell and protected routes:
- `/dashboard`
- `/profile/preferences`
- `/profile/account`
- `/application-fit`
- `/application-fit/history`
- `/signal-intelligence`
- `/ai-interview`
- `/ai-interview/analytics`
- `/ai-interview/history`
- `/ai-interview/role-targeted`
- `/ai-interview/pressure-mode`
- `/ai-interview/resume-deep-dive`
- `/ai-interview/blind-mode`
- `/ai-interview/pair-programming`
- `/resume-vault`
- `/resume-vault/compare`
- `/resume-vault/library`
- resume version/detail routes
- optional `/jobs` and `/jobs/saved` when job discovery is enabled
- optional `/resume-vault/builder` when the resume builder is enabled
- `/interview/:sessionId` for the live interview room

### Backend responsibilities
`backend/main.py` wires together:
- CORS
- exception handling
- access logging
- Redis connection testing
- service status logging
- router registration for:
  - interview
  - career preferences
  - contact
  - application fit
  - job discovery
  - livekit
  - resume builder
  - signal
  - user account
  - vault
- optional websocket fallback router
- `/health` and `/` endpoints

## Configuration

### Root environment variables
Copy `.env.example` to `.env` and fill in backend/runtime values.

Important variables include:
- `JWT_SECRET_KEY`
- `ALLOWED_ORIGINS`
- `API_TOKEN`
- `LLM_PROVIDER`
- `LLM_API_KEY` or `GROQ_API_KEY`
- `GROQ_MODEL`
- `LLM_MODEL`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_AGENT_EMBEDDED`
- `INTERVIEW_WEBSOCKET_FALLBACK_ENABLED`
- `DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`
- `TTS_PROVIDER`
- `JUDGE0_API_KEY`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CREDENTIALS_PATH`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_VAULT_BUCKET`
- `VAULT_STORAGE_DIR`
- `APPLICATION_FIT_ENABLED`
- `JD_FIT_SEMANTIC_ALIGNMENT_ENABLED`
- `VPM_ENABLED`
- `JOB_DISCOVERY_ENABLED`
- `FANTASTIC_JOBS_API_KEY`
- `MEILISEARCH_URL`
- `RESUME_BUILDER_ENABLED`
- `COMPILE_SERVICE_URL`
- `COMPILE_SERVICE_TOKEN`
- `TYPST_BIN`
- `EXPOSE_API_ERRORS`
- `REQUIRE_EMAIL_VERIFIED`
- `RATE_LIMIT_FAIL_OPEN`
- `TRUST_PROXY_HEADERS`
- `TRUSTED_PROXY_IPS`

### Frontend environment variables
Copy `frontend/.env.example` to `frontend/.env`.

Important values:
- `VITE_API_URL`
- `VITE_WS_URL`
- Firebase web config values
- `VITE_USE_LIVEKIT`
- `VITE_LIVEKIT_URL`
- `VITE_SENTRY_DSN`
- `VITE_REQUIRE_EMAIL_VERIFICATION`
- `VITE_RESUME_BUILDER_ENABLED`
- `VITE_JOB_DISCOVERY_ENABLED`

## Run locally

### Docker Compose
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
# fill in the required API keys and service settings

docker compose up --build
```

Services exposed by the compose file:
- backend: `http://localhost:8000`
- frontend: `http://localhost:3000`
- redis: `localhost:6379`

### Backend manually
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Optional helper processes:
```bash
cd backend
python run_livekit_agent.py dev
python run_compile_service.py
```

### Frontend manually
```bash
cd frontend
npm install
npm run dev
```

## Useful scripts

### Frontend
From `frontend/package.json`:
- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run test` — run Vitest once
- `npm run test:watch` — watch mode
- `npm run test:e2e` — Playwright tests
- `npm run check:no-js` — codebase consistency check
- `npm run check:imports` — import/path check
- `npm run check:structure` — run both structure checks

### Backend
Backend is started with Uvicorn and supports separate workers for:
- `python main.py` or `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- `python run_livekit_agent.py dev`
- `python run_compile_service.py`

## How the app is organized

The frontend uses a feature-based architecture:
- `features/auth` — sign-in, sign-up, verification
- `features/dashboard` — dashboard and analytics/history
- `features/interview` — live interview session UI
- `features/application-fit` — score and history views
- `features/job-discovery` — jobs and saved jobs
- `features/modes` — interview mode entry points
- `features/resume-builder` — resume drafting/building
- `features/signal` — signal intelligence area
- `features/user` — profile, preferences, account
- `features/vault` — resume vault, compare, versions, library
- `features/website` — marketing/public pages
- `shared/` — reusable layout, UI, context, query client, hooks, services, utilities

The frontend boots in `frontend/src/index.tsx`, initializes Sentry if configured, and composes providers for auth, backend health, query caching, and confirmation dialogs before rendering `App.tsx`.

The backend boots in `backend/main.py`, loads settings from `backend/config.py`, connects middleware and routers, and conditionally exposes websocket fallback or embedded LiveKit agent behavior based on environment flags.

## Notes

- `product.md` is a product brief and includes aspirational ideas; it should not be treated as the authoritative source for what is currently implemented.
- The current codebase is more feature-rich than the old README suggested, especially around resume vaulting, application-fit scoring, job discovery, and interview mode routing.
- If you enable optional features like LiveKit, resume builder, or job discovery, you must also configure the corresponding external services.
