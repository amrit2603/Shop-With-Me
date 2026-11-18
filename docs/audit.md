# Comprehensive Source Audit & Suspect Verification

Scope read: all source files under `backend/src`, `frontend/src`, database schema, tests, configuration, and delivered archive assets.

---

## 1. Verified Inventory of Known Suspects

| # | Suspect / Area | Code Location | Status in Baseline | Severity |
|---|---|---|---|---|
| 1 | **No room expiry** | `backend/src/db/database.js:37` | **Confirmed**: `rooms` table lacks `expires_at`. No TTL cleanup job or 410 Gone handling. | High |
| 2 | **No profanity filter** | `backend/src/routes/rooms.js` | **Confirmed**: User input for room title, participant names, and comments is saved unmoderated. | Medium |
| 3 | **Missing vote/comment timestamps** | `backend/src/db/database.js:66` | **Confirmed**: `votes` table lacks `created_at`/`updated_at`. Comments have `created_at` but lack `updated_at`. | Medium |
| 4 | **Unprotected participant identity** | `backend/src/routes/rooms.js:140` | **Confirmed**: `participantId` is supplied directly in request body with no token or secret. Anyone can vote or comment as another user. | **Critical** |
| 5 | **Unauthenticated socket `room:join`** | `backend/src/socket.js:35` | **Confirmed**: Sockets join any room with just `{ roomId }`. No token verification. | **Critical** |
| 6 | **No HTTP rate limiting** | `backend/src/server.js` | **Confirmed**: No rate limiting applied to room creation, scraping, voting, or commenting. | High |
| 7 | **Missing Helmet & security headers** | `backend/src/server.js` | **Confirmed**: Helmet is not installed; no CSP, HSTS, X-Frame-Options, or sniffing protection. | High |
| 8 | **Permissive CORS configuration** | `backend/src/server.js:46` | **Confirmed**: Accepts `origin: /^http:\/\/localhost(:\d+)?$/` regex indiscriminately even in production. | Medium |
| 9 | **Excessive JSON body limit (10 MB)** | `backend/src/server.js:52` | **Confirmed**: `express.json({ limit: '10mb' })` opens server to memory exhaustion attacks. | High |
| 10 | **Base64 screenshot storage in SQLite** | `backend/src/routes/rooms.js:89` | **Confirmed**: Screenshots are accepted as base64 strings and stored in SQLite `custom_products.image_url`. | High |
| 11 | **Broadcast recomputes full summary** | `backend/src/socket.js:88` | **Confirmed**: Every mutation re-queries entire room and recalculates full decision summary without debouncing or caching. | Medium |
| 12 | **No pagination for lists** | `backend/src/store/roomStore.js` | **Confirmed**: Comments and participants are returned in full; no cursor-based pagination. | Medium |
| 13 | **Unstructured console logging** | `backend/src/server.js`, `socket.js` | **Confirmed**: Uses `console.log`/`console.error`. No request IDs (`X-Request-Id`) or JSON logs. | Low |
| 14 | **README catalog count mismatch** | `README.md` vs `products.js` | **Confirmed**: README claimed 11 products; `backend/src/data/products.js` contains 24 products. | Low |
| 15 | **Missing product image assets** | `frontend/public/products/` | **Confirmed**: Only 5 images exist in `/public/products`. Remaining 19 catalog items use remote Unsplash URLs. | Medium |
| 16 | **Delivered archive contains dirty artifacts** | Workspace root | **Confirmed**: Delivered folder contained `.env`, `test-*.sqlite` databases, and build artifacts. | Medium |

---

## 2. What Exists & Current Functionality

- **Express 5 API**: Modular routing for health (`/api/health`), products (`/api/products`), and rooms (`/api/rooms`).
- **Socket.IO**: Real-time pub/sub for rooms with events `room:joined`, `participant:joined`, `vote:updated`, `comment:added`, `decision:made`.
- **Database**: SQLite via `better-sqlite3` with WAL mode, foreign keys, transactions, and basic indexes.
- **Decision Engine**: Deterministic weighted scoring algorithm (`Love`=3, `Like`=2, `Need more info`=1, `No`=0) and keyword-based comment sentiment analysis.
- **Frontend**: Vite + React 19 single-page app with `HomePage`, `RoomPage`, and modular UI components (`ParticipantBar`, `ProductVoting`, `ProductComments`, `DecisionSummary`).

---

## 3. Security and Scalability Risks (Ranked by Severity)

### Critical
1. **Broken Object Level Authorization & Spoofing**: Sockets and REST endpoints trust client-provided IDs without tokens or session secrets. An attacker can hijack any participant's votes, impersonate participants, and listen to any room's events.

### High
2. **Denial of Service via Unbounded Payloads & Lack of Rate Limits**: 10 MB JSON bodies and base64 images in SQLite degrade SQLite performance and can exhaust server RAM. Missing rate limits allow brute-force room creation and vote spam.
3. **SSRF Risk in URL Preview**: Ingestion of product links must validate DNS, block internal/loopback/link-local IP addresses (e.g. AWS metadata `169.254.169.254`, `127.0.0.1`), cap response sizes, and restrict redirects.
4. **Missing Live Room Chat**: The extra requirement for real-time room-wide chat alongside voting is completely absent.

### Medium
5. **Real-time Broadcast Inefficiency**: Full room serialization and summary recomputation on every vote or comment causes $O(N \times M)$ overhead that throttles concurrency under load.
6. **Room Expiry & Orphan Data**: No lifecycle management means abandoned rooms stay in SQLite forever, inflating query times.
7. **Offline Demo Vulnerability**: 19 of 24 demo catalog items point to external URLs. An offline or restricted network demo will show broken images.

---

## 4. Phase Execution Roadmap

- **P1**: Room Expiry, Timestamps, Local Profanity Filter, Optional AI Summary Gateway with JSON schema fallback, Catalog Completeness.
- **P2**: Real-time Live Room Chat (persisted, rate-limited, cursor-paginated, typing, presence, mobile tabs).
- **P3**: Identity & Security Hardening (participantToken SHA-256, creator auth, rate-limit, helmet, strict CORS, SSRF guard, disk uploads).
- **P4**: Scalability (Repository abstraction, SQLite WAL tuning, broadcast deltas, summary debounce, load test).
- **P5**: Test Suite & Golden Data (Vitest line coverage >= 80%, 20+ golden fixtures, 100-room seed, concurrency tests).
- **P6**: Clean & Accessible UI (simplified home/create flow, lightweight design tokens, full WCAG compliance).
- **P7**: Operability (Pino structured logging, health checks, Docker multi-stage, GitHub Actions CI).
- **P8**: Documentation, Demo Readiness & Clean Packaging.
