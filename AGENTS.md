# VYUMI Shop With Me / Live Shopping Party

## Product and audience
Prototype for professor and company technical review. Hosts and guests enter display names; signup/login is not required by the current user brief. A per-tab opaque server demo session owns newly created rooms; frontend identity and room credentials live in sessionStorage, not shared cookies/localStorage. Preserve the existing room, vote, comment, wishlist and chat workflows.

## Stack
React 19 + Vite; Node.js + Express + Socket.IO; SQLite WAL. Keep Node. No FastAPI migration, microservices, Kubernetes or GraphQL.

## Commands
- `npm run setup`, `npm run build`, `npm start`
- `npm run test:backend`, `npm run test:frontend`, `npm run lint --prefix frontend`
- `npm run smoke`, `npm run test:e2e`
- `npm audit --omit=dev --prefix backend` and `--prefix frontend`
- `node scripts/load/party-benchmark.js --parties 100 --duration 120`

## Architecture
HTTP: backend/src/server.js and routes/. Room persistence: store/roomRepository.js and roomStore.js. Party persistence: store/partyStore.js and db/partySchema.js. Party socket boundary: partySocket.js. Catalog host: services/shoppingHost.js. UI: components/party/ and its useParty hook. Read PRODUCT.md, docs/party.md, FEATURE_STATUS.md and PROGRESS.md before changing scope.

## Rules
- Backend owns authentication/session checks, host permissions, validation, counts, limits and scores. Recheck participant tokens on writes. Persist authoritative state.
- Reactions reuse the votes table. Never introduce an overlapping voting system. Versions and room scoping are mandatory for party state.
- Counts/rankings/comparisons are computed in code. Optional LLM output may phrase validated facts only. Core functionality must work without a model, merchant APIs or scraping behind login.
- Never weaken/skip existing tests to get green. Changed user contracts require explicit fixture/assertion migrations in a separate test commit with a reason. Report actual checks, not guarantees.
- Never commit secrets, .env, runtime SQLite files, uploads, node_modules or dist. Keep env examples complete. Package source catalogs, lockfiles and the Windows launcher; exclude runtime and local authoring tools.
- Record design/architecture decisions in docs/decisions and phase/checkpoint evidence in docs/PROGRESS.md. Preserve user/room-scoped private saved products and backend room mutation authorization. QR remains removed. The latest explicit request restores clickable code copying and native Share, and restores the preceding rounded landing layout.
- Use Conventional Commits on feat/live-party. Never push to main.
- Treat SQLite/presence/timers/limits as one instance until a shared architecture is implemented and measured. Historical/local benchmark passes do not prove production readiness.

Latest refinement: initial landing stays intact; invited-only flow retains the invitation and requests the name in one panel. Party defaults to host-led navigation; one member picker handles follow/transfer. Compact vote cards expand to full metadata/actions/comments. Preserve these workflows and the existing multi-product add flow.


November 4 superseding brief: independent shared shopping cards, chat and votes. No party entry/follow/host-browsing controls, product comment UI or product image downloads. Retain room invite/name flow, private saves/sharing and compact product help. Legacy backend data/APIs remain for compatibility.
