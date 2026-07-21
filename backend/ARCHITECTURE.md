# Backend Architecture

**Navigation SSOT** for the Vetta.ai FastAPI backend. Cursor agents and humans consult this file before adding routes, services, models, or tests.

Short always-on constraints live in [`.cursor/rules/project.mdc`](../.cursor/rules/project.mdc). Discovered quirks live in [`.cursor/rules/learnings.mdc`](../.cursor/rules/learnings.mdc) — not placement policy. Historical audit: [`docs/BACKEND_ARCHITECTURE_AUDIT.md`](../docs/BACKEND_ARCHITECTURE_AUDIT.md).

---

## Where does new code go?

Answer four questions before creating a file: **domain**, **layer**, **shared?**, **high-risk?**

### New HTTP endpoint

```
Which domain?  interview | vault | jd_fit | resume_builder | livekit | contact
  → routes/<domain>/          (preferred — see interview/)
  → routes/<domain>.py        (legacy single file until split)

Route file must only:
  - verify auth (verify_firebase_token)
  - rate limit (check_rate_limit)
  - parse/validate request body
  - call services/<domain>/*_service.py
  - return response

Never put business logic, LLM calls, or Firestore orchestration in a route.
```

**Examples:** [`routes/interview/start.py`](routes/interview/start.py) → [`interview_start_service.py`](services/interview/interview_start_service.py); [`routes/interview/code.py`](routes/interview/code.py) → [`code_submission_service.py`](services/interview/code_submission_service.py); [`routes/vault.py`](routes/vault.py) upload → [`vault_upload_service.py`](services/vault/vault_upload_service.py).

### New business behavior

```
services/<domain>/<job>_service.py   # name by job, not by layer
```

Mirror an existing service in the same domain. Keep routes thin; keep services focused (one use case per module when a file grows).

Workers (not REST) also live under `services/`:

| Worker | Path |
|--------|------|
| LiveKit agent | [`services/interview/agent/`](services/interview/agent/) |
| WS fallback engine | [`services/interview/session_engine.py`](services/interview/session_engine.py) (frozen — do not extend) |

### New models / DTOs

| If used by… | Put it in… |
|-------------|------------|
| API responses, Redis session blobs, Firestore docs across routes | [`models/`](models/) |
| One pipeline only (e.g. JD Fit scoring internals) | `services/<domain>/*_models.py` or `models.py` |
| Validators at trust boundaries | `services/<domain>/` (e.g. [`contact_validators.py`](services/resume/contact_validators.py)) — **not** inside `models/` importing utils |

### New tests

```
tests/<domain>/test_<module>.py
```

Mirror the service domain. Characterization tests lock behavior before refactors (see [`tests/interview/test_code_submission_service.py`](tests/interview/test_code_submission_service.py)).

### Shared kernel (2+ domains)

```
services/platform/     # LLM today; other cross-domain kernels later
services/jd/extract.py # shared JD text normalize (see docs/JD_EXTRACT_BOUNDARY.md)
```

Do **not** create `backend/helpers.py` or dump cross-domain logic into `utils/` unless it is truly infrastructure (auth, redis, rate limit).

---

## Domain map

| Domain | Routes | Services | Models / notes |
|--------|--------|----------|----------------|
| **Interview** | [`routes/interview/`](routes/interview/) | [`services/interview/`](services/interview/) | [`models/interview.py`](models/interview.py); modes SSOT [`modes/registry.py`](services/interview/modes/registry.py); start body SSOT [`modes/start_configs.py`](services/interview/modes/start_configs.py) |
| **Vault** | [`routes/vault.py`](routes/vault.py) | [`services/vault/`](services/vault/) | [`models/vault.py`](models/vault.py), [`models/resume.py`](models/resume.py) |
| **JD Fit** | [`routes/jd_fit.py`](routes/jd_fit.py) | [`services/jd_fit/`](services/jd_fit/) | [`jd_fit_models.py`](services/jd_fit/jd_fit_models.py) |
| **Resume builder** | [`routes/resume_builder.py`](routes/resume_builder.py) | [`services/resume_builder/`](services/resume_builder/) | compile worker separate from public API |
| **Profile memory (VPM)** | via interview routes | [`services/profile_memory/`](services/profile_memory/) | LiveKit-only pipeline |
| **Platform** | — | [`services/platform/llm/`](services/platform/llm/) | `get_platform_llm()` |
| **LiveKit tokens** | [`routes/livekit.py`](routes/livekit.py) | [`services/livekit/token_service.py`](services/livekit/token_service.py) | — |

Cross-stack mode contract: [`docs/INTERVIEW_MODE_CONTRACT.md`](../docs/INTERVIEW_MODE_CONTRACT.md) + FE [`modeContract.ts`](../frontend/src/features/interview/domain/modeContract.ts).

---

## Layout

```
backend/
  routes/           # HTTP routers — auth, rate limit, delegate to services
    interview/      # split by concern (start, code, history, …)
  services/         # Domain logic + workers
    interview/      # LiveKit agent, sessions, modes, questions
    vault/
    jd_fit/
    platform/       # Cross-domain kernel (LLM)
  models/           # Shared API/storage Pydantic shapes
  utils/            # Redis, auth, rate limit, logging (infra only)
  tests/<domain>/   # Domain-grouped pytest modules
```

**Import direction:** `routes → services → utils`. Never `models/` → business validators in `services/`. Never `services/` importing from `routes/`.

---

## Extract-when-fat (cope with daily features)

When a route or service module exceeds **~150–200 lines of logic** (not counting imports/docstrings):

1. Extract a `*_service.py` in the **same domain** (same PR or immediately after).
2. Leave the route as auth + rate limit + delegate.
3. Do **not** schedule a repo-wide restructure — local extract only.
4. Preserve behavior; add or extend a characterization test if the path is revenue-critical.

This prevents future “massive refactors” without stopping feature velocity.

---

## Daily anti-patterns

| Do not | Do instead |
|--------|------------|
| Business logic in `routes/*.py` | `services/<domain>/*_service.py` |
| New blind `update_session()` on live paths | `SessionStore.update(mutator)` — see session writes below |
| Half-migrations (new package + old copy left wired) | Finish wiring or do not start the split |
| Duplicate mode/route/label strings | `modes/registry.py` + FE `modeContract.ts` |
| Root `helpers.py` / mystery `utils` in a domain | Named module under `services/<domain>/` |
| Drive-by renames in an unrelated PR | One concern per PR |
| Extend WS fallback (`websocket_routes`, `session_engine`) | LiveKit primary; WS frozen |
| New feature flags to hide unfinished refactors | Prove with tests; ship one write path |

---

## Interview start API

`POST /interview/start` body = **common core** (`difficulty`, `candidate_name?`, `years_experience?`, `resume_data?`) + **mode `config`** discriminated on `interview_type`. Config models live in [`services/interview/modes/start_configs.py`](services/interview/modes/start_configs.py). Auth `uid` is server-side only — do not send `user_id`. Redis/Firestore session blobs stay **flat** (start maps `config` → session fields once).

---

## Transport

| Path | Role |
|------|------|
| LiveKit agent ([`services/interview/agent/`](services/interview/agent/)) | **Primary** interview transport |
| WebSocket ([`routes/websocket_routes.py`](routes/websocket_routes.py)) | **Frozen fallback** when LiveKit unavailable |
| REST ([`routes/interview/*`](routes/interview/)) | Start, complete, code submit, history |

Do not extend the WebSocket stack with new features.

---

## Session writes

| Mechanism | Where | When allowed |
|-----------|-------|--------------|
| `SessionStore.update(mutator)` | LiveKit agent, code submit | Live paths — atomic read-modify-write |
| `SessionStore.replace()` | Session create, legacy agent coding controls | Initial blob or documented legacy only |
| `create_session()` | `interview_start_service` | New session |
| `persist_ws_session_blob()` | WS `session_engine`, `answer_processor` | Merged write via SessionStore |
| `update_session()` blind SET | Legacy only | **Do not add new call sites** |

**Rule:** Mutators must not drop keys another writer may have added (`session_conductor`, `live_transcription`, coding fields). Use [`deep_merge_session_conductor()`](services/interview/session_store.py) when patching conductor state.

---

## High-risk files

Touch only with characterization tests + smoke; no drive-by cleanup.

| File | Why |
|------|-----|
| [`services/interview/agent/`](services/interview/agent/) | LiveKit primary path; VPM on disconnect |
| [`services/interview/session_store.py`](services/interview/session_store.py) | Atomic RMW semantics |
| [`services/interview/session_engine.py`](services/interview/session_engine.py) | WS state machine (frozen) |
| [`services/interview/interview_start_service.py`](services/interview/interview_start_service.py) | Session create |
| [`services/interview/completion_guard.py`](services/interview/completion_guard.py) | Double-complete prevention |
| [`services/interview/modes/registry.py`](services/interview/modes/registry.py) | Start gate SSOT |
| [`routes/interview/code.py`](routes/interview/code.py) | Coding submit entry |
| [`services/profile_memory/*`](services/profile_memory/) | LiveKit-only VPM pipeline |

---

## Per-PR merge blockers

```bash
py -3.11 -m pytest tests --collect-only   # zero collection errors
py -3.11 -m pytest tests -v               # full suite green (fix or skip owned failures)
graphify update .                         # after code file changes
```

Interview PRs additionally require manual golden path: role_targeted voice session, pair_programming code submit, completion → history.

---

## LLM calls

- Use `get_platform_llm()` / `LLMEngine` from [`services/platform/llm/`](services/platform/llm/) only — no interview-local shim.
- Never call Groq/Gemini directly from a route.

---

## Model placement (summary)

- **API/storage enums, shared session shapes** → [`models/`](models/)
- **Domain pipeline DTOs** → `services/<domain>/*_models.py`
- **Validators** → `services/<domain>/` — keep [`models/`](models/) dumb

---

## After this doc (structural work — only when a file hurts)

Not part of daily placement; small parity PRs when touching the area:

- Split [`routes/vault.py`](routes/vault.py) → `routes/vault/` (mirror interview)
- Wire [`services/interview/agent/livekit_agent.py`](services/interview/agent/livekit_agent.py) fully to [`session_ops.py`](services/interview/agent/session_ops.py) + [`server.py`](services/interview/agent/server.py)
- Remaining agent coding controls → SessionStore mutators (equivalence-tested)
