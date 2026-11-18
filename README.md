Latest UI/session changes and acceptance results: [Tab and room fixes](docs/TAB_ROOM_FIXES_REPORT.md).

# VYUMI Shop With Me

Feature 5 lets a host shortlist 2–8 products, share a room link or six-character code, and get friends' opinions without accounts. Friends vote, comment, chat, and privately save products for themselves. The host chooses the final item and can export a decision card.

This release preserves React 19 + Vite, Node.js + Express 5, Socket.IO, and SQLite. It implements the core social loop and the quick wins in sections 1–2 of the feature-ideas PDF. It does not implement the other teams' Features 1 and 2.

## Quick review

- Begin with [the latest tab/room report](docs/TAB_ROOM_FIXES_REPORT.md) and [the feature-status index](docs/FEATURE_STATUS.md); older party/QR descriptions elsewhere are historical and may not describe the current interface.
- Trace HTTP and room permissions through [backend/src/routes/](backend/src/routes/) and authoritative persistence through [backend/src/store/](backend/src/store/). Review [the backend tests](backend/tests/) alongside those boundaries.
- Follow the [professor demo](docs/DEMO_PROFESSOR.md) or [technical demo](docs/DEMO_TECH.md). This is a single-instance prototype; a display name is not a verified identity and historical load results are not a production-capacity guarantee.

## Start locally

On Windows, double-click `Start-Vyumi.cmd`. It checks Node, installs missing dependencies, builds a missing frontend, and keeps startup errors visible. If the server is already running it opens the app. Otherwise, keep the launcher window open and visit http://localhost:3001 after the server reports it is running.

Use Node.js 24 LTS (minimum 22.12) and npm. From this folder:

```sh
npm run setup
npm run build
npm start
```

Open http://localhost:3001. Enter your display name and choose Enter demo. No email, password, signup or sign-in is required. Friends join by code/link with a display name. No paid API, merchant credentials, or AI model is required. The app serves the built frontend and backend on one port. For development, run `npm run backend` and `npm run frontend` in separate terminals; open http://localhost:5173.

The backend install deliberately uses `--ignore-scripts`: better-sqlite3 13.0.3 ships prebuilt native binaries for supported platforms, while npm otherwise attempts an unnecessary node-gyp build on Windows. A clean install and a SQLite query were verified on this machine. Exotic platforms may require a native build toolchain.

## Live Shopping Party prototype

The latest demo uses name-only private sessions. Name the decision and shortlist products, then choose Start Shopping Party to enter the room directly. The host synchronizes the product/gallery view for friends, switches Host/Explore modes, takes suggestions, passes control and ends the party. Four reaction choices reuse the existing votes. Live presence, comments, product-tagged chat and attachments remain available. The deterministic VYUMI Host compares actual catalog data, answers supported spec/price questions, detects disagreement and summarizes votes without a model or paid API.

Ending the party creates a shareable result, public `/r/:shareId` page with social metadata, copy/share controls and a locally generated PNG. The creator can hide names or revoke the link. Old /signin URLs redirect to the demo homepage. Account API endpoints remain for compatibility, but no account form is required or displayed in the demo.

The prototype is one Node/SQLite instance. A demo name is not a verified identity, and losing the browser session loses creator access. See [party documentation](docs/party.md), [professor demo](docs/DEMO_PROFESSOR.md), [technical demo](docs/DEMO_TECH.md), and measured [load results](docs/party-load.json). Catalog recommendations stay within the room's shortlist; missing specs remain unknown. No video/voice or merchant checkout is supplied.

## What works

- Room title validation, Outfit/Gift/Gadget/Home starter titles, searchable 24-item demo catalog, and 2–8 item shortlists.
- Public product-page preview with SSRF protections and manual review; screenshot upload with manual name and optional INR price. Missing prices stay unknown.
- Share link, unique room code, native sharing when supported, WhatsApp handoff, and locally generated scannable QR code.
- Guest nicknames with room-scoped secret tokens; host-only shortlist changes and final choice.
- Four live reactions to products: Love, Like, No, Need more info. A changed vote replaces the previous vote.
- Persistent product comments, room chat, product tags, typing, presence, three image/PDF attachments per message, and live emoji reactions.
- Configurable 1-hour to 7-day deadline and live countdown; expired rooms reject actions and are cleaned up.
- Deterministic vote summary, optional Ollama paragraph with validated JSON and fallback, host final choice, and downloadable PNG decision card.
- Private “Save for me” wishlist, JSON export, product-link copying, and image downloads where browser/source permissions allow them.
- Responsive products/chat/summary tabs, keyboard focus styles, reduced-motion support, and readable error states.

The wishlist stays in this browser's local storage; it is not shared with the room or synced to another device. Uploaded images may disappear after room expiry. Export the list or download an image to retain your own copy. Demo prices and branded product descriptions are sample data, not verified merchant offers or medical claims.

## Verify

```sh
npm run check
npm run smoke
npx playwright install chromium
npm run test:e2e
node scripts/load/load-benchmark.js --rooms 50 --duration 20
npm audit --omit=dev --prefix backend
npm audit --omit=dev --prefix frontend
```

`check` runs frontend lint, all backend and frontend unit/integration tests, and a production build. The project is JavaScript, so there is no separate TypeScript typecheck. See `docs/RELEASE_NOTES.md` for measured results and limits. Browser tests include three-client collaboration and attachments, independent identities, guest wishlist privacy, persisted reactions, screenshot storage, PNG export, and 375px overflow checks.

## Demo for October 30 and technical review on October 31

1. Create a room named “Weekend outfit shortlist”. Search the catalog or add a screenshot and select at least two items. Set a deadline.
2. Share the link or code. A friend opens it in another browser/device and enters a nickname. No signup is needed.
3. Change Like to Love; show the count update on the host's screen. Add a comment, send a chat message, react, and refresh to show persistence.
4. Have the friend choose “Save for me”. Open Saved for me to show that it is their own list.
5. On the host screen open Group Decision, select My Final Choice, and download the PNG.
6. For the technical review, show permission tests, SSRF tests, the unique vote key, the load-test results, and backup/restore commands.

A localhost link only works on the same computer. For a phone on the same trusted Wi-Fi, open the app using this computer's LAN address on port 3001, configure `backend/.env` with that exact `FRONTEND_URL`, and restart the backend. Allow the port only if permitted by your network administrator. For off-network friends, use a deployed HTTPS address.

## API and permissions

Room URLs are invitation capabilities: anyone with the full link/code can view the shortlist and join. Keep private rooms' links private. The guest token protects a participant's writes; it does not prove a unique human or prevent a person joining under another nickname.

| Endpoint | Purpose | Permission |
| --- | --- | --- |
| `POST /api/rooms` | Create, `{title, expiresInHours?}` | Private demo/legacy session, rate limited |
| `GET /api/rooms/:id` | Room and summary | Invitation link/code |
| `POST /api/rooms/:id/participants` | Join or restore guest | Name; token for existing identity |
| `POST /api/rooms/:id/products` | Add catalog item | X-Creator-Token |
| `POST /api/rooms/:id/products/custom` | Add reviewed manual product | X-Creator-Token |
| `POST /api/rooms/preview/products/from-url` | Stateless page preview | Public, rate limited |
| `POST /api/rooms/:id/products/from-screenshot` | Validate/store screenshot | X-Creator-Token |
| `DELETE /api/rooms/:id/products/:productId` | Remove product | X-Creator-Token |
| `POST /api/rooms/:id/products/:productId/votes` | Replace guest vote | X-Participant-Token + participantId |
| `POST /api/rooms/:id/products/:productId/comments` | Product comment | X-Participant-Token + participantId |
| `GET /api/rooms/:id/messages` | Paginated chat | X-Participant-Token + participantId |
| `POST /api/rooms/:id/attachments` | Attach files | Guest token and participant ID |
| `GET /api/rooms/:id/attachments/:attachmentId` | Read chat attachment | Room guest token |
| `PUT /api/rooms/:id/final-choice` | Select winner | Host token |
| `GET /api/health`, `/api/health/live` | Diagnostics and liveness | Public |

Socket.IO `room:join` validates guest identity before writes; `chat:send`, `chat:typing`, and `chat:react` operate on that bound identity. Reactions persist in SQLite and hydrate with paginated history. Request logs omit query strings so attachment tokens are not logged.

## Data and architecture

`backend/src/routes/` contains HTTP routes; `backend/src/store/` owns SQLite transactions; `backend/src/services/` contains summaries, tokens, uploads, reactions and SSRF validation; `backend/src/socket.js` handles room-scoped broadcasts. `frontend/src/services/` centralizes API/socket clients. Tables use foreign keys and cascades; a composite primary key prevents duplicate product votes. WAL mode, indexes, bounded caches, small event payloads and debounced summaries support the measured single-instance workload.

The new reaction table is an additive schema change in `backend/src/db/database.js`, idempotent on startup. Existing column migrations are retained. Migration errors now stop startup instead of being hidden. Before upgrading an existing database, create a backup and run the application against a restored copy.

## Backups

```sh
node scripts/backup.js backend/data/shop-with-me.sqlite backend/backups/release.sqlite
node scripts/restore-check.js backend/backups/release.sqlite backend/backups/restore-test.sqlite
```

The first command uses SQLite's online backup API and verifies integrity. The second restores into a new file, checks integrity, and counts rooms without touching the running database. Both refuse to overwrite a target. Database backup does not copy uploads: snapshot the upload volume alongside it. Configure actual scheduled backups, off-host retention and restore drills in the hosting environment; no schedule is created by these scripts.

## Hosting and scaling

Copy `backend/.env.example` to `backend/.env` if needed. Set the exact public `FRONTEND_URL`, `NODE_ENV=production`, and durable database/upload paths. Leave frontend API/socket variables empty for one-origin hosting. If hosting the frontend separately, set `VITE_API_URL` and `VITE_SOCKET_URL` before building and set `API_PUBLIC_URL` for uploaded images.

`docker compose up --build` has a Node 24, non-root, single-instance configuration with persistent volumes. Docker execution was not verified in this Windows environment. TLS, domain, network access, secret management, backups, monitoring/alerts, and a deployed smoke test remain operator responsibilities.

SQLite is the current persistence layer. Run **one application instance** with a local persistent disk; do not place the database on a network share or scale to multiple independent SQLite databases. The optional Redis adapter does not make SQLite horizontally scalable. Before multi-instance deployment, implement an asynchronous PostgreSQL repository, shared object storage, distributed rate limits/presence, cache invalidation, and test that topology. See `docs/scaling.md`.

## Models and license notes

Core behavior uses no AI. Optional Ollama is configured through `OLLAMA_URL` and `OLLAMA_MODEL`; the existing default is `llama3.2`. The model receives sanitized comments and computed vote counts, and its JSON is validated. No Ollama model was downloaded or tested during this release. Confirm the exact model's license before commercial use.

Room sharing now uses WhatsApp and Copy link; QR generation was removed by request. Existing dependency licenses and the rights to catalog images, names and descriptions must be reviewed by the company before public commercial release. This work does not grant rights to third-party assets.

## Limits and troubleshooting

- URL import reads public HTML metadata. JavaScript-only stores or blocked sites require manual details/screenshot; no CAPTCHA or login is bypassed.
- Chat file limits are three files, 3 MB each, and 20 MB per room. Image checks inspect signatures, not malware or comprehensive image decoding. Add scanning/moderation for untrusted public uploads.
- Image downloads may be blocked by source CORS. The UI explains the failure and keeps the saved-product/link alternatives.
- Clearing browser storage loses guest/host credentials and private saved items. There is no account recovery or cross-device wishlist sync.
- Optional Redis clustering and Ollama inference were not exercised in this release. Email/push notifications, merchant checkout, blind voting, head-to-head duels and the other teams' features are not implemented.
- If native SQLite installation attempts to compile on Windows, use `npm ci --prefix backend --ignore-scripts` as in setup. If ports are occupied, stop the app you started or configure its port; do not reuse an unrelated test server.

## Package

`npm run pack` creates a source ZIP beside this folder. It excludes credentials, runtime databases/uploads, dependencies, build output, coverage and test artifacts. The original supplied ZIP is unchanged. Production readiness requires the deployment checks above; passing local tests is not a guarantee of zero bugs or unlimited scale.

## Compact interface update

The creation form is one screen. A party starts directly after choosing products; standard rooms and expiry settings remain under Room options. Product, reactions and conversation stay visible. Host/browsing/transfer/end settings are under Party controls; product help is under Compare & ask. Comments, product details and optional chat tags use disclosures. See docs/COMPACT_UI_REPORT.md for reference sources, screenshots and checks.
