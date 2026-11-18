# Delivery Progress & Phase Checklist

## Baseline Environment
- **OS**: Windows (x64)
- **Node**: v24.15.0
- **npm**: 11.12.1
- **Branch**: `feat/final-polish`
- **Baseline Test Counts**:
  - Backend Vitest: 4 test files, **99 passed / 0 failed** (100%)
  - Frontend Vitest: 2 test files, **22 passed / 0 failed** (100%)
  - Frontend Lint: Oxlint **0 errors, 0 warnings**
  - Frontend Build: Vite build **succeeded** (373 KB JS / 56 KB CSS)
  - Security Audit: backend and frontend production audit each report **0 vulnerabilities** after patching transitive `body-parser`

---

## Phase Matrix

| Phase | Description | Exit Criteria | Status | Iterations | Last Gate Result |
|---|---|---|---|---:|---|
| **P0** | Baseline, memory file, audit | `CLAUDE.md` exists, baseline numbers recorded, smoke script runs, `audit.md` written | **DONE** | 2 | G1: 99 passed, G2: 22 passed, G3: 0 errors / warnings, G4: Built, G5: 0 vulnerabilities both prefixes, G6: smoke passed |
| **P1** | Spec compliance gaps | Room expiry (TTL, 410, cleanup), Timestamps on votes/comments, Profanity filter with false-positive tests, Optional AI summary (Ollama gateway with schema validation & fallback), Catalog completeness & working images, README fixes | **DONE** | 1 | G1: 114 passed, G2: 22 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed |
| **P2** | Live Room Chat | `room_messages` table & migration, Socket `chat:send`/`chat:message`/`chat:typing`, presence update, cursor-paginated REST GET, profanity & rate limits, UI chat panel + mobile tabs, multi-client tests | **DONE** | 1 | G1: 119 passed, G2: 33 passed, G3: exit 0 (warnings), G4: Built, G5: 0 vulnerabilities, G6: smoke passed with reconnect history |
| **P3** | Identity & Security Hardening | Participant SHA-256 tokens & constant-time compare, creator auth, socket room:join auth, helmet, strict CORS, express-rate-limit, zod schemas, SSRF DNS/IP guard, disk uploads, security.md | **DONE** | 1 | G1: 129 passed, G2: 33 passed, G3: 0 errors (2 warnings), G4: Built, G5: 0 vulns both prefixes, G6: smoke passed |
| **P4** | Backend Scalability | Repository/Store abstraction (ready for Postgres), SQLite WAL/pragmas/indexes, delta broadcasts, summary debounce (150ms) & version cache, cursor pagination, Redis adapter flag, load test report | **DONE** | 1 | G1: 130 passed, G2: 33 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed, REST p95 149ms, Fanout p95 4ms |
| **P5** | Testing, Golden Set, Demo Data | >= 80% line coverage, 20+ hand-checked golden fixtures (`tests/golden/`), 100-room synthetic seed, 3 polished demo rooms (
pm run seed:demo`), concurrency tests, Playwright 2-context E2E | **DONE** | 1 | G1: 156 passed, G2: 33 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed, E2E: passed, Coverage: 81.84% |
| **P6** | Simple, Clean UI | Simplified home (Start/Join), streamlined create flow, clean room layout with winner plain callout, design tokens CSS, component split (<250 lines), 4 UI states (loading, empty, error, success), WCAG AA & 375px responsive | **DONE** | 1 | G1: 156 passed, G2: 33 passed, G3: 0 errors, G4: Built (343kB JS, 30kB CSS / 44% reduction), G5: 0 vulns, G6: smoke passed, E2E: 2 passed |
| **P7** | Operability | Pino structured JSON logging with `X-Request-Id` and token redaction, diagnostic `/api/health` + `/api/health/live`, Zod env validation, multi-stage Dockerfile + docker-compose, CI workflow | **DONE** | 1 | G1: 162 passed, G2: 33 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed |
| **P8** | Docs & Demo Readiness | Rewritten comprehensive README, `DEMO_PROFESSOR.md` (5-min script), `DEMO_TECH.md` (15-min tech walkthrough), `FEATURE_STATUS.md` matrix, clean packaging | **DONE** | 1 | G1: 162 passed, G2: 33 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed, Clean zip created |

---

## Gate Protocol Checklist
- **G1**: 
pm run test:backend`
- **G2**: 
pm run test:frontend`
- **G3**: 
pm run lint --prefix frontend`
- **G4**: 
pm run build`
- **G5**: 
pm audit --omit=dev --prefix backend` & 
pm audit --omit=dev --prefix frontend`
- **G6**: 
ode scripts/smoke.js`

### P0 Exit Evidence (2026-10-29)

- 
pm run test:backend`: 4 files passed, 99 tests passed.
- 
pm run test:frontend`: 2 files passed, 22 tests passed.
- 
pm run lint --prefix frontend`: exit 0 with no findings.
- 
pm run build`: Vite build passed (373.03 kB JS, 56.07 kB CSS).
- 
pm audit --omit=dev --prefix backend`: 0 vulnerabilities; updated transitive body-parser to 2.4.0 after the initial high advisory.
- 
pm audit --omit=dev --prefix frontend`: 0 vulnerabilities.
- 
ode scripts/smoke.js`: `SMOKE PASS: room, 2 guests, 2 votes, 2 comments, live chat, summary, and final choice`.

The P0 smoke runner exposed the missing room chat path, so the first implementation slice now includes a `room_messages` table, member-checked REST history, message validation, and room-scoped Socket.IO delivery. Identity currently checks participant IDs; P3 must add random participant secrets and hashed token verification before this chat path is safe for untrusted rooms. The frontend test baseline had 7 failures; component behavior was restored in code without editing tests.

### P1 Plan

1. Migrate room expiry plus vote/comment timestamps safely for old SQLite databases; test old and new schema paths.
2. Enforce TTL in HTTP and sockets, and add an unref'd cleanup timer controlled by environment.
3. Add a no-dependency local text filter with normalization and false-positive coverage; apply it to names, comments, and chat.
4. Add an optional Ollama JSON gateway with a strict summary/reasons schema and deterministic fallback, tested with fake responses/timeouts.
5. Extend catalog shape and stable image fallbacks, correct README's catalog/test/runtime claims, then run the full gate.

Risks: room reads must distinguish missing from expired (404 vs 410), old SQLite files may need repeated migrations, and AI must never control any product identifiers or arithmetic.

### P1 Exit Evidence (2026-10-29)

- Room TTL defaults to 168 hours, can be set through `ROOM_TTL_HOURS`, and expired room links return 410 through HTTP and Socket.IO. The unref'd cleanup timer defaults to hourly and can be changed with `ROOM_CLEANUP_INTERVAL_MS`; a small tombstone preserves 410 behavior after room rows are deleted.
- Additive migrations retain legacy room, vote, and comment data; tests cover old schemas, expiry cleanup, and vote/comment timestamps.
- The local profanity filter is applied to display names, comments, and chat; unit and integration coverage includes leetspeak, punctuation obfuscation, repeated characters, Scunthorpe, and class.
- `llmGateway.js` is optional and dependency-free. It validates the strict JSON summary schema and times out after at most 5 seconds. API summaries remain deterministic if Ollama is disabled or fails. The prompt contains only participant/count structures and comment text, without product names, IDs, prices, or URLs.
- All 24 catalog entries expose SKU, brand, currency, images, and bullets; catalog and shortlist views use the existing `ProductImage` fallback on image failure.
- README now reports the real 24 item catalog and current test totals.
- Final G1–G6 outputs: backend 114/114; frontend 22/22; lint exit 0; Vite build exit 0 (373.51 kB JS / 56.56 kB CSS); audits each report 0 vulnerabilities; smoke prints `SMOKE PASS: room, 2 guests, 2 votes, 2 comments, live chat, summary, and final choice`.

### P2 Plan

1. Complete chat protocol: presence on join/leave/disconnect, throttled typing, per-participant 5-per-10-second limit, history pagination and reconnect deduplication. Add multi-client isolation, persistence, validation, and expiry tests.
2. Add a focused `ChatPanel` component and CSS for message history, retry/error states, typing, online dots, unread state, bottom-aware scrolling, and disconnected input behavior.
3. Integrate it into the room layout beside products and add 375 px Products | Chat | Summary tabs. Keep all text as plain escaped text.
4. Update the smoke runner to assert chat history and reconnect persistence; run G1–G6 and record a manual browser run only when actually performed.

### P2 Exit Evidence (2026-10-29)

- Added persistent room chat history, monotonic message timestamps, room-scoped socket delivery, cursor pagination, 500-character validation, profanity rejection, and a limit of five sends per participant per ten seconds.
- Presence is tracked per connected socket and participant. Join, leave, and disconnect update the room presence list; typing events are throttled. A socket cannot leave a room other than its current subscription.
- Added the chat panel with history loading, empty/error/retry states, product tags, plain text rendering, typing and online indicators, unread mobile tab badge, earlier-page loading, bottom-aware scrolling, send acknowledgement, and reconnect history refresh.
- Backend chat tests cover multi-client delivery and room isolation, persistence and cursor pages, validation/profanity, rate limits, presence and typing. Frontend suite covers loading, empty, error/retry, history rendering and sending.
- The strict smoke runner now fails on missing acknowledgement/delivery, disconnects and reconnects a sender, and verifies the persisted message appears exactly once in history.
- Final G1–G6: backend 119/119; frontend 33/33; frontend lint exit 0 with warnings in the current chat/room effects; Vite build passed (380.65 kB JS / 61.20 kB CSS); backend and frontend production audits each report 0 vulnerabilities; smoke prints `SMOKE PASS: room, 2 guests, 2 votes, 2 comments, live chat, reconnect history, summary, and final choice`.

Risk carried into P3: socket and REST chat history still identify participants by their interim IDs; authenticated participant tokens and creator authorization remain outstanding.

### P3 Plan

1. Add additive participant-token hash migration and return raw tokens only at create/join; require constant-time token verification for REST mutations, chat history, socket joins, and creator actions. Update frontend storage and API/socket callers.
2. Add HTTP hardening: Helmet, env-based strict CORS, bounded JSON/screenshot payloads, rate limits, and Zod validation at route boundaries; retain friendly API errors.
3. Replace product URL preview fetch with the DNS/IP-aware bounded redirect fetch guard; move screenshot uploads to randomized files under `/uploads` and delete them with the room.
4. Add adversarial tests for impersonation/cross-room access, private and redirect SSRF, oversized bodies, and XSS-as-text behavior. Write `/docs/security.md` with mitigations and residual limits.
5. Run G1–G6 after each implementation step and again at phase exit; preserve all existing tests.

### P3 Exit Evidence (2026-10-29)

- Generated 256-bit cryptographically random tokens on room creation (`creatorToken`) and participant join (`participantToken`), storing only their SHA-256 hashes in SQLite. Constant-time verification with `crypto.timingSafeEqual`.
- Mutating REST endpoints (`POST /votes`, `POST /comments`, `PATCH /participants`) verify `X-Participant-Token`. Sockets enforce token verification on `room:join` and `chat:send`.
- Added HTTP security hardening: `helmet` security headers, strict CORS allowlist mapped from `FRONTEND_URL`, bounded JSON parsing (100 KB default, 3 MB for screenshots), and tiered rate limiters (`express-rate-limit`).
- Uploads store verified magic bytes under `/uploads` with random filenames and safe headers (`X-Content-Type-Options: nosniff`).
- Implemented `ssrfGuard.js` with DNS pre-resolution, private IP filtering, max 3 redirects, and 1 MB stream cap.
- Tested: cross-room access, impersonation, forged tokens, SSRF targets, oversized payloads (413), and XSS safety.
- Documented complete threat matrix, defensive controls, and known boundaries in `/docs/security.md`.
- Final G1–G6: backend 129/129; frontend 33/33; frontend lint exit 0 with two React effect warnings; Vite build passed (382.18 kB JS / 61.20 kB CSS); backend and frontend production audits each report 0 vulnerabilities; strict chat smoke prints `SMOKE PASS: room, 2 guests, 2 votes, 2 comments, live chat, reconnect history, summary, and final choice`.

---

### P4 Exit Evidence (2026-10-29)

- Established `IRoomRepository` contract in `backend/src/store/roomRepository.js` and documented complete PostgreSQL migration blueprint in `/docs/scaling.md`.
- Tuned SQLite pragmas (`synchronous=NORMAL`, `busy_timeout=5000`, `temp_store=MEMORY`) and added covering indexes for hot queries.
- Executed `EXPLAIN QUERY PLAN` on top 5 queries, proving 100% index coverage without full table scans.
- Implemented broadcast delta events and debounced decision summary calculation (150ms) with monotonic room version counter caching in `backend/src/socket.js`.
- Added ETag caching (`W/"..."` with `304 Not Modified`) on static catalog and 15s request timeout guard.
- Added graceful shutdown sequence closing active sockets, HTTP listener, and SQLite connection cleanly.
- Implemented and executed load benchmark (`scripts/load/load-benchmark.js`):
  - **REST p50**: 27 ms
  - **REST p95**: 149 ms (target < 200 ms passed)
  - **REST p99**: 238 ms
  - **REST throughput**: 1,117.3 req/s with 0 errors (target 0 errors passed)
  - **Socket.IO fan-out p50**: 2 ms
  - **Socket.IO fan-out p95**: 4 ms (target < 300 ms passed)
  - Full report recorded in `/docs/load-test.md`.
- Gate G1–G6: backend 130/130; frontend 33/33; lint exit 0; Vite build exit 0; audits 0 vulns; smoke passed.

---

### P5 Exit Evidence (2026-10-29)

- **Golden Test Set (`backend/tests/golden/`, `backend/tests/golden.test.js`)**: 22 hand-checked JSON room fixtures representing authentic ties, score ties broken by Love votes, ties broken by total volume, high-concern sentiment, max capacity rooms, and single-vote rooms. 23 tests passing.
- **Synthetic Data Generator (`scripts/seed.js`)**: Idempotent generator seeding 100 synthetic rooms with 2,733 votes and 994 comments across 3–8 participants per room.
- **Polished Demo Rooms (`scripts/seed-demo.js`, 
pm run seed:demo`)**: Idempotent seed script creating 3 presentation-ready rooms:
  1. `demo-wedding-outfit` ("Wedding Outfit with Friends")
  2. `demo-gift-for-mom` ("Mother's Birthday Gift")
  3. `demo-speaker-flat` ("Living Room Speaker for the Flat")
- **Concurrency Verification (`backend/tests/concurrency.test.js`)**: 3 concurrency test suites verifying 50 simultaneous votes maintain exact counts, and rapid duplicate vote modifications by a single participant atomically update without doubling.
- **Backend Line Coverage (`vitest --coverage`)**: Achieved **81.84% line coverage** across backend (routes: 86.06%, services: 82.22%, store: 81.13%, db: 89.39%), meeting the >=80% target across 156 tests.
- **Playwright End-to-End Test (`tests/e2e/room-collaboration.spec.js`)**: Multi-context browser testing with 2 concurrent contexts (Creator & Friend) testing: room creation -> shareable link -> friend joins with no account -> live voting sync -> live comment sync -> live room chat (<1s latency) -> creator final choice -> decision card display.
- **Test Quality Validation**: Confirmed 0 `.skip` and 0 `.only` in the entire test suite. Intentionally broke a scoring rule (`Love: 99`) and verified 10 tests failed immediately across 4 suites; intentionally bypassed creator authorization and verified security tests failed immediately with HTTP 403 failure; reverted both immediately.
- Gate G1–G6:
  - G1 (`test:backend`): 156/156 passed across 13 test files.
  - G2 (`test:frontend`): 33/33 passed across 4 test files.
  - G3 (`lint`): 0 errors.
  - G4 (`build`): Vite production build clean.
  - G5 (`audit`): 0 vulnerabilities across backend and frontend.
  - G6 (`smoke`): Passed.
  - E2E (`test:e2e`): Passed (10.7s execution across 2 browser contexts).

---

### P6 Exit Evidence (2026-10-29)

- **Component Size Limit (<250 lines)**: Every component in `frontend/src/` is strictly under 250 lines:
  - `pages/HomePage.jsx`: 147 lines
  - `pages/RoomPage.jsx`: 236 lines
  - `components/home/HomeHero.jsx`: 82 lines
  - `components/home/CreateRoomFlow.jsx`: 172 lines
  - `components/home/RoomReadyCard.jsx`: 100 lines
  - `components/room/RoomHeader.jsx`: 64 lines
  - `components/room/RoomProductCard.jsx`: 59 lines
  - `components/room/RoomSummaryPanel.jsx`: 123 lines
  - `components/room/RoomMobileTabs.jsx`: 41 lines
  - `components/RoomChat.jsx`: 191 lines
  - `components/DecisionSummary.jsx`: 238 lines
  - `components/LeaderboardCard.jsx`: 100 lines
  - Deleted obsolete dead components (`AddProductModal.jsx` and `AddProductModal.css`).
- **Radical UI Simplification**:
  - Home: Only two primary actions displayed: "Start a room" and "Join with a code". Removed all marketing blocks, diagrams, and decorative clutter.
  - Creation: Step 1 room title -> Step 2 select 2-8 products (catalog cards first, URL and screenshot collapsed under "Add custom product") -> Room ready card with copy link, copy code, and direct room enter.
  - Room: Header displays title, expiry countdown ("Expires in X days"), active online participants, and share link. Small subtle connection dot.
  - Winner summary: Prominently renders plain statement ("Product is winning: X pts") with expandable details and creator-only final choice button.
  - Layout: Desktop layout features product grid beside Chat & Group Decision tabs; mobile layout (375px) provides sticky bottom tabs (`Products | Chat | Summary`).
- **CSS Code Reduction**:
  - Consolidated tokens into `frontend/src/index.css` (neutral light palette, single accent blue `#2563eb`, system typography, standard 4/8/16/24/32 spacing, AA contrast).
  - Reduced total frontend CSS size by **44.2%** (from 89,282 bytes down to 49,818 bytes), well exceeding the >=40% reduction target.
  - Production bundled CSS reduced from 56.56 kB down to 30.62 kB.
- **Responsive Proof**:
  - Captured actual screenshots at 1280px desktop and 375px mobile via Playwright in `tests/e2e/screenshots.spec.js`:
    - `docs/screens/home-1280px.png`
    - `docs/screens/home-375px.png`
    - `docs/screens/room-1280px.png`
    - `docs/screens/room-375px.png`
- **Gate G1–G6 Output**:
  - G1 (`test:backend`): 156/156 tests passing across 13 test files.
  - G2 (`test:frontend`): 33/33 tests passing across 4 test files.
  - G3 (`lint`): 0 errors.
  - G4 (`build`): Vite production build clean (343.37 kB JS, 30.62 kB CSS).
  - G5 (`audit`): 0 vulnerabilities across backend and frontend.
  - G6 (`smoke`): `SMOKE PASS: room, 2 guests, 2 votes, 2 comments, live chat, reconnect history, summary, and final choice`.
  - E2E: 2 passed (collaboration journey across 2 contexts + responsive screenshot capture).

---

### P7 Plan: Operability (Structured Logging, Health Checks, Containerization, CI/CD, Scripts)

1. **Structured Logging (`pino`)**:
   - Replace unstructured `console.log` statements with `pino` logger.
   - Attach unique `requestId` to every request via middleware (`crypto.randomUUID()`) and reflect in response header `X-Request-Id`.
   - Redact sensitive data (`participantToken`, `creatorToken`, `authorization`, `password`).
   - Log level configurable via `LOG_LEVEL` env var (default: `info`).
2. **Comprehensive Health Checks**:
   - `/api/health`: Comprehensive check executing active DB read/write probe, reporting uptime, app version, memory usage, and active socket connections.
   - `/api/health/live`: Fast process liveness probe returning HTTP 200 `{ status: 'alive' }`.
3. **Environment Startup Validation**:
   - Strict `zod` schema in backend initialization validating all required/optional environment variables (`PORT`, `NODE_ENV`, `FRONTEND_URL`, `OLLAMA_URL`, etc.). Fails fast and loudly with clear error explanations.
   - Complete `.env.example` with comprehensive documentation and default values.
4. **Production Containerization**:
   - Multi-stage `Dockerfile` (build frontend Vite bundle, prepare lean Node.js production image with only production dependencies).
   - In production mode, Express static middleware serves `frontend/dist`.
   - `docker-compose.yml` supporting standard app operation and optional Redis profile.
5. **CI/CD & Root Scripts**:
   - GitHub Actions workflow (`.github/workflows/ci.yml`): Node 20 LTS, install -> lint -> backend tests -> frontend tests -> build -> audit -> smoke.
   - Dependabot configuration (`.github/dependabot.yml`).
   - Root npm scripts: `setup`, `dev:all`, `test:all`, `seed:demo`, `load`.
6. **Gate G1–G6 Verification**:
   - Run complete gate suite before declaring P7 complete.

### P7 Exit Evidence (2026-10-29)

- **Structured Logging (`backend/src/logger.js`)**:
  - Replaced ad-hoc unstructured `console.log` statements across the server with high-performance `pino` JSON structured logger.
  - Generates or propagates `X-Request-Id` for every incoming HTTP request and attaches child loggers with duration, route, and status code.
  - Automatically redacts sensitive tokens (`participantToken`, `creatorToken`, `authorization`, `password`).
  - Configurable log level via `LOG_LEVEL` env var with `silent` default in test mode.
- **Diagnostic Health Check & Liveness (`backend/src/routes/health.js`)**:
  - `GET /api/health`: Executes active SQLite read/write probe (transaction + query), reports uptime seconds, package version, active Socket.IO connection count, and memory metrics (`rssMb`, `heapUsedMb`).
  - `GET /api/health/live`: Fast process-only liveness probe returning `{ status: 'alive' }` for Docker / orchestrator health checks.
- **Startup Environment Validation (`backend/src/services/envValidator.js`)**:
  - Implemented strict `zod` schema validating network ports, environment types, room TTL hours, cleanup intervals, and log levels.
  - Added comprehensive root `.env.example` and `backend/.env.example` with documented configuration options and defaults.
- **Containerization**:
  - Created multi-stage `Dockerfile` (Stage 1 compiles React 19 SPA, Stage 2 builds lean Node 20 runtime with `better-sqlite3` native bindings and Express serving built static assets).
  - Created `docker-compose.yml` supporting single-port app (`3001:3001`) with optional Redis profile (`profiles: [redis]`).
  - Docker CLI v29.7.2 is installed; Docker Desktop daemon was not running on the local host machine, so the container definitions and configurations were verified for compliance.
- **CI/CD & Root Scripts**:
  - Created `.github/workflows/ci.yml` verifying G1–G6 across Node.js 20 LTS.
  - Created `.github/dependabot.yml` monitoring root, backend, frontend, and github-actions ecosystems.
  - Added root npm scripts: `setup`, `dev:all`, `test:all`, `seed:demo`, `load`.
- **Gate G1–G6 Output**:
  - G1 (`test:backend`): 162/162 passed across 14 test files (+6 operability tests).
  - G2 (`test:frontend`): 33/33 passed across 4 test files.
  - G3 (`lint`): 0 errors.
  - G4 (`build`): Vite production build clean.
  - G5 (`audit`): 0 vulnerabilities across backend and frontend production dependencies.
  - G6 (`smoke`): `SMOKE PASS: room, 2 guests, 2 votes, 2 comments, live chat, reconnect history, summary, and final choice`.

---

### P8 Plan: Docs and Demo Readiness

1. **Comprehensive README Rewrite (`README.md`)**:
   - Product overview & promise ("Shop With Me" collaborative decision engine).
   - 3-command quick start: 
pm run setup`, 
pm run seed:demo`, 
pm run dev:all`.
   - Architectural Mermaid diagram (React 19 Vite, Express 5, Socket.IO, SQLite WAL, Pino, optional Ollama/Redis).
   - Complete API reference and Socket event reference.
   - Environment variables reference.
   - Test commands (G1–G6, E2E, golden set, load benchmarks).
   - Limitations, AI gateway licensing notes, and architectural trade-offs.
2. **5-Minute Non-Technical Demo Script (`docs/DEMO_PROFESSOR.md`)**:
   - Story: "Choose a wedding outfit with friends".
   - Clear click-by-click instructions, what to say, and what NOT to touch.
   - Offline / localhost fallback steps using pre-seeded room `demo-wedding-outfit`.
3. **15-Minute Technical Team Walkthrough (`docs/DEMO_TECH.md`)**:
   - System architecture, data model, real-time sync flow, security measures.
   - Test pyramid with verified numbers, load test benchmark metrics (p50/p95/p99).
   - Scaling path (SQLite to Postgres, horizontal clustering with Redis adapter).
   - 5 most likely technical questions with senior-level answers.
4. **Feature Status Matrix (`docs/FEATURE_STATUS.md`)**:
   - Complete table mapping every single requirement from the VYUMI spec and task brief to exact code paths and tests.
5. **Clean Package Verification**:
   - Ensure `.env`, `*.sqlite`, 
ode_modules`, and `dist` are not tracked.
   - Add 
pm run pack:clean` script to package a clean zip distribution.
6. **Final Gate Verification**:
   - Execute full G1–G6 and print the Final Verification Report.

### P8 Exit Evidence (2026-10-29)

- **Comprehensive README Rewrite (`README.md`)**:
  - Full product summary & value proposition for VYUMI Feature 5 ("Shop With Me").
  - 3-command quick start (
pm run setup`, 
pm run seed:demo`, 
pm run dev:all`).
  - Core features and step-by-step user journey.
  - Complete Mermaid system architecture diagram.
  - Complete REST API and Socket.IO event reference with payloads and auth headers.
  - Complete environment variables table with defaults and descriptions.
  - Detailed verification commands and real test counts.
  - AI summary specification (Ollama llama3.2, input/output schemas, fallback guarantee).
  - Production Docker multi-stage build & Compose deployment instructions.
  - Links to dedicated demo walkthrough scripts.
  - Honest known limitations and dependency/model licensing notes.
- **Academic / Non-Technical Demo Script (`docs/DEMO_PROFESSOR.md`)**:
  - 5-minute, jargon-free narrative script ("Choosing a wedding outfit with friends").
  - Clear click-by-click instructions, what to say, and what NOT to touch.
  - Offline/localhost fallback steps using pre-seeded room `demo-wedding-outfit`.
- **Technical Deep-Dive Walkthrough (`docs/DEMO_TECH.md`)**:
  - 15-minute comprehensive technical guide: system architecture, relational SQLite schema with foreign keys and covering indexes, real-time sync flow with 150ms debouncing, zero-trust token authentication.
  - Test pyramid with real numbers (162 backend, 33 frontend, 23 golden, 3 concurrency, 2 e2e).
  - Scalability benchmarks under 2,000 active participants (p50: 27ms, p95: 149ms, 0 errors).
  - Postgres migration roadmap and horizontal Redis clustering.
  - 5 hard technical questions with senior-level answers.
- **Feature Status & Acceptance Verification Matrix (`docs/FEATURE_STATUS.md`)**:
  - Exhaustive table mapping every single user journey step, spec rule, and acceptance criterion to implementing source files and proving tests. All items verified **PASS**.
- **Clean Distribution Packaging (`scripts/pack.js`)**:
  - Implemented 
pm run pack` generating `vyumi-shop-with-me-delivery.zip`.
  - Verified archive contains zero secrets (`.env`), zero databases (`*.sqlite*`), zero 
ode_modules`, and zero `dist` build artifacts.
- **Gate G1–G6 Output**:
  - G1 (`test:backend`): 162/162 passed across 14 test files.
  - G2 (`test:frontend`): 33/33 passed across 4 test files.
  - G3 (`lint`): 0 errors.
  - G4 (`build`): Vite production build clean (343.37 kB JS, 30.62 kB CSS).
  - G5 (`audit`): 0 vulnerabilities across backend and frontend production dependencies.
  - G6 (`smoke`): `SMOKE PASS: room, 2 guests, 2 votes, 2 comments, live chat, reconnect history, summary, and final choice`.

---

## Round 2 Phase Matrix (`feat/round2`)

| Phase | Description | Exit Criteria | Status | Iterations | Last Gate Result |
|---|---|---|---|---:|---|
| **R1** | Identity (show the right name at top) | Delete all hardcoded developer names; room top bar shows active participant chip (avatar, initials, stable color, Host badge, rename menu) and participants strip (max 5 +N, online dots, "You" badge); sessionStorage per tab + localStorage per room ("Continue as <name>" / "Join as someone else"); Playwright 2 contexts + 1 extra tab test passes | **DONE** | 1 | G1: 162 passed, G2: 33 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed, E2E: 4 passed |
| **R2** | Mandatory room name & easy code | Reject invalid room titles (3-60 chars, trimmed, not only punctuation, profanity-filtered, not literal "room", allow unicode); quick-pick starter chips ("Outfit", "Gift", "Gadget", "Home"); 6-char unambiguous alphabet room codes; copy code/link with live announcement & Web Share API | **DONE** | 1 | G1: 164 passed, G2: 33 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed, E2E: 5 passed |
| **R3** | Room Chat UI with attachments | React Bits Pro Chat 5 layout & attachments (JPEG, PNG, WebP, PDF; max 3 files, 3MB/file, 20MB/room); authenticated serve route; magic bytes check; upload security tests | **DONE** | 1 | G1: 173 passed, G2: 33 passed, G3: 0 errors, G4: Built, G5: 0 vulns, G6: smoke passed, E2E: 6 passed |
| **R4** | Final result card: CircularGallery | Free React Bits CircularGallery WebGL2 with activeIndex prop, onUnsupported podium fallback, same-origin safe image proxying | **TODO** | 0 | - |
| **R5** | Multi-brand white-label | Multi-brand schema (`brands`, `brand_keys`, `catalog_products`); `/b/:brandSlug` hosted experience & deep links; embed widget; admin catalog importer; 3 synthetic demo brands | **TODO** | 0 | - |
| **R6** | Simple, clean UI & one palette | Single palette tokens CSS; remove developer copy; unified `Intl.NumberFormat` currency; <= 250 lines/file | **TODO** | 0 | - |
| **R7** | Carried over hardening & gate checks | Concurrency, SSRF DNS guard, load test benchmarks (k6/autocannon) | **TODO** | 0 | - |
| **R8** | Docs, demo readiness, clean package | Updated README, `DEMO_PROFESSOR.md`, `DEMO_TECH.md`, `FEATURE_STATUS.md`, clean zip | **TODO** | 0 | - |

### R1 Exit Evidence (2026-10-29)
- **Zero occurrences of hardcoded developer names**: Verified across all files in repository (`git grep` and automated test assertion).
- **Per-Room & Per-Tab Identity**: Active participant is stored in `sessionStorage` per tab, with last used participant remembered in `localStorage` per room. Opening a link in a second tab displays a welcome back card with "Continue as <name>" and "Join as someone else".
- **Dynamic Navbar Strip & Current User Chip**:
  - Stable avatar background color derived deterministically from participant ID hash.
  - Initials computed from display name.
  - "Host" badge displayed exclusively for room creators.
  - Interactive "Change name" dropdown menu executing `PATCH /api/rooms/:roomId/participants/:participantId` and broadcasting real-time `participant:updated` socket events.
  - Participants strip displaying up to 5 avatars with real-time green presence dots, "(You)" indicators, and `+N` overflow pills.
- **Home Page Clean View**: Displays saved user chip if identity exists from prior room; renders clean with zero fake sign-out or profile buttons if unauthenticated.
- **Playwright E2E**: `tests/e2e/identity.spec.js` verified 2 browser contexts + extra tab in the same context simultaneously acting as three distinct users with real-time strip updates and renames.
- **Gates Result**:
  - G1 (`test:backend`): 162/162 passed.
  - G2 (`test:frontend`): 33/33 passed.
  - G3 (`lint`): 0 errors.
  - G4 (`build`): Vite production build clean (356.28 kB JS, 45.07 kB CSS).
  - G5 (`audit`): 0 vulnerabilities across backend and frontend.
  - G6 (`smoke`): `SMOKE PASS`.
  - Playwright: 4/4 passed (identity, collaboration, screenshots).

### R2 Exit Evidence (2026-10-29)
- **Mandatory Room Name Enforced**: Backend rejects invalid titles with 400 and friendly message `"Give your room a name so friends know what you're deciding"` for empty strings, spaces only, <3 characters, >60 characters, punctuation/emoji only, profanity, or literal word "room". Valid unicode scripts (Hindi/Devanagari, Kannada) and repeated space collapsing verified.
- **Unambiguous 6-Character Room Code**: Server generates uppercase codes from a 27-character unambiguous alphabet (`234679ACDEFGHJKMNPQRTUVWXYZ`), omitting `0, O, 1, I, L, 5, S, 8, B`. Route matching resolves codes regardless of spaces, hyphens, or casing (`d79 pcv` and `d79-pcv` resolve to `D79PCV`).
- **Interactive Room Ready Card & Header Access**:
  - Displays code in very large monospaced font with tap-to-copy interaction.
  - Distinct "Copy link" and "Copy code" buttons with confirmation feedback and `aria-live` screen-reader announcements.
  - Zero-dependency local SVG QR code generator with no external network calls.
  - Web Share API (
avigator.share`) support.
  - Accessible from room header via invite button or clicking the room code.
  - Migration-safe display of `"Untitled room"` for missing/empty room titles.
- **Gate Output**:
  - G1 (`test:backend`): 164/164 passed across 14 test files.
  - G2 (`test:frontend`): 33/33 passed across 4 test files.
  - G3 (`lint`): 0 errors.
  - G4 (`build`): Vite production build clean (362.35 kB JS, 49.22 kB CSS).
  - G5 (`audit`): 0 vulnerabilities across backend and frontend.
  - G6 (`smoke`): `SMOKE PASS`.
  - Playwright E2E: 5/5 passed (including `room-name-and-code.spec.js`).

### R3 Exit Evidence (2026-10-29)
- **Chat 5 Layout & Fallback Path**: Checked `$env:REACTBITS_LICENSE_KEY` (missing), executed the clean fallback path matching React Bits Chat 5 block: grouped message bubbles within 5-min intervals, initials avatar with stable hash colors, timestamps, product attachment tags, and unread badges.
- **Attachments Pipeline & Hardened Security**:
  - `attachmentService.js`: inspects magic bytes (`verifyMagicBytes`) supporting JPEG, PNG, WebP, and PDF; rejects SVG, HTML, scripts, and executables.
  - File constraints: 3 MB per file cap, max 3 files per upload, and 20 MB room quota enforced in SQLite.
  - Secure storage: files written to `/uploads/rooms/<roomId>/<randomHex>.<ext>` with sanitized filenames preventing path traversal.
  - Authenticated route `GET /api/rooms/:roomId/attachments/:attachmentId` enforces room membership, participant token verification, and returns `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` for images, and `attachment` for PDFs.
  - Cascade cleanup: expired rooms delete physical upload directories and database metadata.
- **Rich Composer & Lightbox UI**:
  - File picker button triggering file selector for allowed types.
  - Drag-and-drop overlay zone over chat panel.
  - Clipboard image paste directly from clipboard.
  - Staged attachment preview chips with removal buttons and per-file validation error messages.
  - Click-to-view fullscreen image lightbox with escape key dismissal and download action.
- **Gate Output & Test Verification**:
  - G1 (`test:backend`): 173/173 passed across 15 test files (including 9 tests in `attachments.test.js`).
  - G2 (`test:frontend`): 33/33 passed across 4 test files.
  - G3 (`lint`): 0 errors.
  - G4 (`build`): Vite production build clean (368.72 kB JS, 53.98 kB CSS).
  - G5 (`audit`): 0 vulnerabilities across backend and frontend.
  - G6 (`smoke`): `SMOKE PASS` (extended to upload attachment and verify real-time chat linkage).
  - Playwright E2E: 6/6 passed (including 3-client chat with attachment exchange and lightbox verification in `chat-attachments.spec.js`).
  - Mobile 375px verified: captured and saved `docs/screens/chat-mobile-375px.png`.




## October 29 delivery
See RELEASE_NOTES.md for the current scope, 178 backend tests, 33 frontend tests, 8 browser scenarios, clean lint/build, smoke, 500-guest load evidence, QR decode and backup/restore verification. Earlier phase metrics are historical.

## Live Shopping Party � L1 PLAN
Iteration 1. Add persistent sessions, auth validation/rate limits, login UI, correct identity and account ownership. P1-P8 pending. No new phase has passed its gate yet.

## November 2 — further party UI simplification

The user requested a simpler, compact interface and fewer confusing host/assistant choices. The default now presents a single product above four reactions and a thumbnail tray, alongside Chat/Votes. Management actions use Manage party; product assistance uses Help me choose; human control is labeled Leading. Comparison selectors and details/comments open only when needed. Party chat drops duplicate heading/minimize controls, while standard rooms retain them. Added the intended shared screen-reader-only utility and a regression test ensuring a minimized standard room becomes usable when upgraded to a party.

Verified on the final UI: 34 frontend tests and all 10 browser scenarios passed (47.1s); lint/build/smoke passed; mechanical UI scan returned no findings. Desktop/mobile captures include the default closed controls and mobile reactions above the tab bar. Backend code and dependencies were unchanged; no new load/deployment run was performed. Existing 230-test backend and single-instance load evidence are historical but unaffected by this UI pass.

Reference and access evidence: docs/SIMPLE_UI_REPORT.md. Rikover's named design was retrieved and visually inspected; Verishop behavior was available in a search excerpt. Mobbin refused the search because a paid plan is required; LinkedIn/CollabVerse were not verified visual references. No uninspected reference was claimed as design evidence.

## November 2 Live Shopping Party delivery

The latest brief replaces mandatory signup/login with name-only demo sessions. Implemented versioned persistent party state, synchronized product/gallery navigation, Host/Explore modes, suggestions, host transfer and a 30-second fallback, mapped/toggle reactions, existing presence/comments/chat, deterministic catalog host, ended-party write rejection, public share/revoke/hide-name results, and image download. Old /signin URLs redirect to demo entry.

Clean-source setup and verification passed: 230 backend tests, 33 frontend tests, 10 browser scenarios; no failures/skips. Lint/build, expanded smoke, and both production audits passed. Backend services/store/routes coverage: 82.01% statements, 84.41% lines, 86.47% functions, 71.06% branches. Deliberate permission/scoring mutations were detected and restored. Impeccable scan reported no findings. Desktop/mobile/public screenshots are saved.

Fixed new fixture setup, expiry/injection handling, Vite public-result routing, the smoke reconnect socket, repeated whole-room hydration/preparation and overlapping reaction feeds, join-time ordering ties, and ranking of unreacted products. The 100-party/600-participant/120-second rerun completed 64,040 operations with zero errors; navigation p95 33.3ms and client REST p95 49.95ms. Long-tail spikes and raw before/after reports remain visible.

Prototype core meets the latest brief. Production deployment and multi-instance coordination remain unimplemented; branch coverage is below 80%, and a new six-sneaker seed is not supplied. See party.md, FEATURE_STATUS.md, scaling-party.md and LIVE_PARTY_REPORT.md. Earlier account-only and pending-party entries below are historical.

## November 2 account/login gate
L1 implementation: account registration/login/logout/me, hashed sessions and per-account room credentials, creator account ownership, guest identities per tab, stale-name removal, auth UI and origin checks. Backend gate iteration 4: 189/189 passed; frontend 33/33; lint clean; build passed; both production audits zero vulnerabilities; smoke passed; full browser suite 9/9 passed in 48.7 seconds. The final backend rerun passed 190/190, including independent-IP/email-limit enforcement and Retry-After. No existing assertions were removed: test fixtures migrated to the new account contract in separate test commits; the name-length assertion was strengthened from 50 to 24 per the new spec.

Overall request remains IN PROGRESS. P1-P8 are NOT IMPLEMENTED. No synchronized party controls, AI shopping-host extension, public party result page, 100-party benchmark, or new coverage figure is claimed. See LOGIN_STATUS.md for explicit limits. This is a login-stage checkpoint, not the requested finished Live Shopping Party release.

## Compact UI revision — November 2
User requested the simplest compact UI while keeping Feature 5/5.1. Replaced hero-plus-builder with one shortlist form and default party creation; auto-enter the live room. Standard rooms, expiry and starter names remain as optional disclosures. Default party view keeps product/reactions/conversation visible; Party controls and Compare & ask hold occasional actions. Product details/comments/tagging are disclosures; duplicate invite control removed, QR remains accessible from room code. Removed unused HomeHero JSX/CSS and its dependency on shared control styles. No backend runtime changes in this revision.

The existing backend suite passed 230 tests. Frontend 33 tests, lint/build and expanded smoke passed. The stable full browser run passed 10/10, including the 4-context navigation/reaction/transfer/Explore/comparison/end/share journey. New assertions verify default controls/help/comments are hidden and all four reactions fit above mobile navigation at 375px. Initial test fixtures were migrated to the new creation/invite entry points without removing feature assertions. Corrected a visual styling dependency and mobile bottom-tab overlap found during review. Screenshots: compact-party-default.png, compact-party-mobile-default.png and party-before-simplification.png. Details and reference access limits: COMPACT_UI_REPORT.md. Mobbin search tools were unavailable; Firecrawl retrieved the four supplied reference images and Rikover case study. The company production/scaling limits remain unchanged.

## November 3 — audited violet/glass redesign

Tasks 1/2 delivered; see REDESIGN_AUDIT.md and REDESIGN_REPORT.md. Replaced the lime visual identity with the user-pinned video direction, centralized theme values, self-hosted Manrope, redesigned landing and all routed/legacy views, added actual party-stage presence, and opened help/comments with user-approved assertion migration. Public HTML and canvas exports use shared tokens; Docker copies presentation sources. No voting, session, score, persistence or socket protocol changes.

Fresh gates: lint/build/smoke passed; frontend 34/34, backend 230/230, browser 13/13 (1.7m). Scan returned []. Before/after screenshot gallery covers 16 surfaces at 1280/375 plus exports; extended baseline comes from isolated unchanged 9e5b8c4. Independent reviewer found mobile URL clipping and native ranking button; both fixed and scored resolved, ship at fix-list scope. Added regression for actual 320/375 button bounds. No existing tests removed/skipped.

Task3 not started. No new load/deployment/Docker/hardware/full-accessibility run. Single-instance backend, deterministic host and single-image catalog limitations remain. Complete command counts, bundle changes, reference/tool evidence and limits are in REDESIGN_REPORT.md.


## November 3 — requested tab/room fixes

Implemented the eight requested changes with the existing stack: full viewport landing; WhatsApp/Copy link share card (QR/code-copy removed); explicit tab-session authentication and duplicate-tab detection; server-scoped follow/member state; user/room-scoped personal saves and product links; reused live persisted comments; three-question helper; complete vote cards and existing winner calculation. Preserved room product addition and authoritative voting. Fixed logout navigation, clipboard fallback, mobile reaction overlap and stale save indicator found during verification.

Fresh final gates: backend 233/233 (20 files, 22.04s sequential), frontend 39/39 (7 files, 4.14s), browser 14/14 (1.4m), lint/build/smoke passed. Mechanical scan checkpoint returned []. Acceptance flow asserts no browser console/page errors. Earlier failed parallel runs lost test servers; release gates were rerun sequentially. Existing test contracts for QR, shared remembered identity and complex assistant were explicitly migrated; no scenario removed or skipped.

See TAB_ROOM_FIXES_REPORT.md for all 11 PASS acceptance rows, each changed file, current screenshots and limits; TAB_ROOM_FIXES_VERIFICATION.txt for observed evidence. Personal saves clear on logout/tab close; unknown merchant/quality details stay unknown; follow state remains transient single-instance. No deployment/load/hardware certification.


## November 3 — landing / Share / clickable-code restoration

Latest user request supersedes full-viewport landing and display-only code. Restored the prior rounded landing, native Share with direct invitation URL/copy fallback, and clickable code copying (including the header code chip). Unified remaining copy callers under the checked helper and removed the stale QR tooltip. Fixed the launcher silently opening an older running copy; it now asks the user to stop that terminal first, without killing processes.

Fresh gates: backend 233/233, frontend 42/42, browser 14/14 (1.5m), lint/build/smoke passed; both production audits zero known vulnerabilities; mechanical scan []. Actual clipboard readback replaces seeded impeccable text with the six-character code. Native share data/cancellation/fallback checked; real physical OS sharing was not exercised. Updated landing/share assertions in a separate contract migration; no scenarios removed/skipped.

Details, exact changed files, screenshots and limits: LANDING_SHARE_RECHECK.md and LANDING_SHARE_VERIFICATION.txt. No production/deployment guarantee follows from this local recheck.


## November 3 — retained invitations and simpler host-led party

Kept the initial landing; added a compact invited-only name step retaining its code/link. Separated native Share and WhatsApp, centered Leave demo. Host Previous/Next is explicit; removed duplicate member/transfer controls while preserving Explore/follow/suggestions. Fixed local/follow/gallery precedence during host navigation/regroup/transfer and unrelated updates. Votes reuse compact cards with expandable complete details and bounded scrolling.

Backend 234/234, frontend43/43, full browser14/14; affected two browser scenarios rerun after final gallery change:2/2 (59.5s). Lint/build/smoke passed, detector[]. Rendered desktop/mobile reviewed. Separate test contract commits retain every scenario. SIMPLIFIED_PARTY_RECHECK.md lists each changed file and limits; SIMPLIFIED_PARTY_VERIFICATION.txt records evidence. Mobbin refused the paid-plan-gated reference query. No physical-device/deployment/load certification.


## November 3 — product help, separate comments, explicit chat tags

Limited source edits to product tools/comments and the chat/host context boundary. Restored catalog questions/comparison; kept quick recommendations optional/collapsed. Save/View/More reduces initial actions; product comments have their own compact thread. Removed automatic chat tagging when no product was selected. Existing landing, invitation, host navigation/management, vote layout and end controls retained.

Backend236/236 (two workers after an initial native runner crash), frontend47/47, full browser14/14; affected2/2 after helper refinement. Lint/build/smoke and rendered desktop/mobile checks passed. Final compact touch-target visual gate recorded in PRODUCT_HELP_CHAT_VERIFICATION.txt. See PRODUCT_HELP_CHAT_RECHECK.md for each changed file and limitations. No data migration, dependencies or physical-device/deployment/load certification.


November 4: simple shared rooms supersede party UI and product comments. Image downloads removed; product help now works without a party through authorized room endpoint. Backend237,frontend47,browser13 passed; lint/build/visual checks passed. See SIMPLE_ROOM_RELEASE.md; retired party browser contracts preserved outside active suite by explicit feature-removal migration.


November4: compact selectable paper/charcoal room tiles retain Buy/votes; details/help/save/share move to one animated panel below. Landing uses source-derived ThreeUI glass-button adapter, retaining existing typography and native actions. Frontend47/browser13 and finalfocused1 passed; lint/build/detector passed. Exact full upstream font integration is partial; see TILES_AND_BUTTONS_RELEASE.md.
