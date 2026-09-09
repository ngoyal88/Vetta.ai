# Vetta.ai

Vetta.ai is a full-stack career preparation platform with a FastAPI backend and a React + Vite frontend. The current implementation focuses on AI interview workflows, resume/vault tooling, application-fit analysis, and related profile intelligence features.

## What is implemented today

### Core product areas
- **AI Interview**: start/complete sessions, interview history, coding submissions for pair-programming mode, and profile-claim workflows.
- **Resume Vault**: upload, versioning, restore, compare, and analysis endpoints for resumes.
- **Application Fit**: compute fit against job descriptions, store snapshots, and browse fit history.
- **Signal Intelligence**: readiness scoring and readiness history APIs.
- **Career Preferences + Account**: preferences APIs and account deletion/purge flow.
- **Contact**: public contact form endpoint with optional authenticated context.

### Feature-flagged modules (present in code, disabled by default in examples)
- **Job Discovery** (`JOB_DISCOVERY_ENABLED=false`, `VITE_JOB_DISCOVERY_ENABLED=false`)
- **Resume Builder** (`RESUME_BUILDER_ENABLED=false`, `VITE_RESUME_BUILDER_ENABLED=false`)

## Architecture summary

### Frontend (`/frontend`)
- React 19 + TypeScript + Vite
- Routing split into:
  - public website pages (`/`, `/pricing`, `/contact`)
  - auth routes (`/signin`, `/signup`, `/verify-email`)
  - authenticated app routes (dashboard, interview, vault, profile, etc.)
- Data fetching uses TanStack Query.
- Firebase client auth is used for authenticated API calls.

### Backend (`/backend`)
- FastAPI app (`backend/main.py`)
- Domain routes include: `interview`, `vault`, `application_fit`, `signal`, `career_preferences`, `user_account`, `livekit`, `resume_builder`, `job_discovery`, `contact`
- Redis is used for interview session state/rate-limit support.
- Firebase Admin SDK is used for auth verification and Firestore access.
- Optional integrations: LiveKit, Deepgram, Groq/Gemini, Supabase, Meilisearch, Judge0, Typst compile service.

## Repository structure

```text
Vetta.ai/
├─ backend/
│  ├─ main.py
│  ├─ config.py
│  ├─ requirements.txt
│  ├─ routes/
│  ├─ services/
│  └─ models/
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ src/
├─ .env.example
├─ frontend/.env.example
├─ docker-compose.yml
└─ product.md
```

## Local setup

### 1) Prerequisites
- Python **3.11**
- Node.js **18+** (or current LTS)
- npm
- Redis (local or container)

### 2) Backend setup

```bash
cd /home/runner/work/Vetta.ai/Vetta.ai
cp .env.example .env

cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

Start Redis (example with Docker):

```bash
docker run --name vetta-redis -p 6379:6379 -d redis:7-alpine redis-server --requirepass <REDIS_PASSWORD>
```

Run the API:

```bash
cd /home/runner/work/Vetta.ai/Vetta.ai/backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: `http://localhost:8000/docs`

### 3) Frontend setup

```bash
cd /home/runner/work/Vetta.ai/Vetta.ai/frontend
cp .env.example .env
npm install
npm run dev
```

Default dev URL: `http://localhost:5173`

### 4) Optional local workers/services
- LiveKit agent worker: run from `backend/` with `python run_livekit_agent.py dev` when LiveKit is configured and not embedded.
- Resume Builder compile service: `python run_compile_service.py` (serves on `:8001`).
- Meilisearch is required for Job Discovery search when that feature is enabled.

## Environment configuration overview

### Backend env (`/.env` from `.env.example`)
Key groups:
- API/security: `JWT_SECRET_KEY`, `ALLOWED_ORIGINS`, `API_TOKEN`
- LLM: `LLM_PROVIDER`, `LLM_API_KEY`, `GROQ_API_KEY`, model settings
- Interview transport: `LIVEKIT_*`, `INTERVIEW_WEBSOCKET_FALLBACK_ENABLED`, `DEEPGRAM_API_KEY`, `TTS_PROVIDER`
- Storage/data: `REDIS_*`, `FIREBASE_*`, `SUPABASE_*`
- Feature flags: `APPLICATION_FIT_ENABLED`, `JOB_DISCOVERY_ENABLED`, `RESUME_BUILDER_ENABLED`, `VPM_ENABLED`
- Job discovery ingest/search: `FANTASTIC_JOBS_*`, `MEILISEARCH_*`, budget controls

### Frontend env (`/frontend/.env` from `frontend/.env.example`)
- API/WS: `VITE_API_URL`, `VITE_WS_URL`
- Firebase client config: `VITE_FIREBASE_*`
- Optional integrations: `VITE_USE_LIVEKIT`, `VITE_LIVEKIT_URL`, `VITE_SENTRY_DSN`
- Feature flags: `VITE_RESUME_BUILDER_ENABLED`, `VITE_JOB_DISCOVERY_ENABLED`

## Run/test commands

### Frontend (`/frontend/package.json`)
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run test` — Vitest
- `npm run test:e2e` — Playwright
- `npm run check:structure` — import + JS-boundary checks

### Backend
- `pytest` (from `backend/`) — pytest is configured via `backend/pytest.ini`; no backend test files are currently checked in

## Docker notes

A root `docker-compose.yml` is present and defines `backend`, `redis`, and `frontend` services.

At the time of writing, the compose file references `frontend/Dockerfile`, but this file is not present in the repository. For now, local backend/frontend startup (above) is the reliable development path unless you add that Dockerfile in a separate infrastructure update.

## Product brief status

`product.md` describes broader product vision (including items such as auto-apply flows). Treat it as **vision/aspirational context** rather than a strict representation of what is currently wired end-to-end in this repository.
