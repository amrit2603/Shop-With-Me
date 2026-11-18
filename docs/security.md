# Security Architecture & Threat Model

This document outlines the security controls, threat mitigations, and known boundaries implemented for VYUMI Feature 5 ("Shop With Me").

---

## 1. Threat Matrix & Mitigations

| Threat | Risk Level | Mitigation Implemented | Verification Test |
|---|---|---|---|
| **Participant Impersonation** (Attacker supplies a victim's `participantId` to vote or comment) | High | Server generates a 256-bit cryptographic token on join (`createToken()`). Database stores only the SHA-256 hash. Mutating REST requests (`POST /votes`, `POST /comments`, `PATCH /participants`) require `X-Participant-Token`. Verified with constant-time equality check (`crypto.timingSafeEqual`). | `backend/tests/security.test.js` |
| **Creator Privilege Escalation** (Non-creator finalizing product choice or deleting products) | High | Room creator receives a 256-bit `creatorToken` at room creation. Stored only as SHA-256 hash in SQLite. Final choice (`PUT /final-choice`) and product deletion require bearer authorization matching this hash. Tokens are never leaked in public GET endpoints. | `backend/tests/rooms.test.js`, `backend/tests/security.test.js` |
| **Cross-Room Access** (Participant in Room A attempts to vote, comment, or chat in Room B) | High | Backend verifies participant membership within the specific room ID before any mutation. Token hash is looked up strictly with composite key `(room_id, participant_id)`. | `backend/tests/security.test.js` |
| **Server-Side Request Forgery (SSRF)** (Attacker supplies internal URL like `http://169.254.169.254` or `http://localhost:8080` to scrape cloud metadata or internal services) | Critical | `ssrfGuard.js` validates protocol (HTTP/HTTPS only), resolves DNS before connection, validates every resolved address, pins the connection to a validated IP to prevent DNS rebinding, checks `robots.txt`, validates each redirect target (max 3 hops), enforces a 5s timeout, and caps response streams at 1 MB. | `backend/tests/ssrfGuard.test.js`, `backend/tests/security.test.js` |
| **Unauthenticated WebSocket Spoofing** (Client joins room and broadcasts events without registration) | High | `socket.io` validates room existence, non-expired status, and participant credentials on join. Forged credentials emit `room:error` (`INVALID_PARTICIPANT_TOKEN`) and reject presence tracking and chat access. Payload size capped at 100 KB (`maxHttpBufferSize`). | `backend/tests/socket.test.js`, `backend/tests/security.test.js` |
| **Denial of Service via Payload Flooding** (Large JSON payloads crashing Node.js event loop or exhausting RAM) | Medium | Strict body-parser boundaries: default JSON limit capped at 100 KB; screenshot uploads capped at 3 MB with magic-byte verification. Excessively large payloads return HTTP 413 `PAYLOAD_TOO_LARGE`. | `backend/tests/security.test.js` |
| **Abuse & Chat Spam** (Flooding room with automated messages or votes) | Medium | Socket chat rate limiter enforces max 5 messages per 10 seconds per participant. HTTP rate limiters enforce tiered caps: room creation (20/hour), URL previews (10/15min), general API (300/15min). | `backend/tests/chat.test.js`, `backend/src/server.js` |
| **Profanity & Abuse in Content** (Obscene display names, comments, or chat messages) | Medium | Deterministic zero-dependency normalization filter strips leet-speak, repeated characters, and punctuation before checking against blocked terminology while preserving safe substrings (e.g. "Scunthorpe", "classic"). | `backend/tests/profanityFilter.test.js` |
| **Stored XSS** (Malicious HTML/script injected in titles, comments, or chat) | High | All content is treated as opaque string data on backend. Frontend escapes all dynamic strings with standard React JSX bindings (no `dangerouslySetInnerHTML`). Database query parameters are 100% parameterized via `better-sqlite3`. | `backend/tests/security.test.js` |
| **Insecure Screenshot Storage** (Malicious files or SQLite DB bloat from base64 images) | Medium | Uploaded images are validated via file magic bytes (JPEG, PNG, GIF, WebP, BMP), written to `/uploads` with random hexadecimal names, served with `X-Content-Type-Options: nosniff` and non-executable file permissions (`0o640`), and cleaned up when rooms expire. | `backend/src/services/uploads.js`, `backend/tests/rooms.test.js` |

---

## 2. Defensive Controls Implemented

1. **Helmet HTTP Headers**:
   - `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`.
2. **CORS Hardening**:
   - Strict origin allowlist driven by `FRONTEND_URL` environment variable. In production, wildcard or arbitrary localhost origins are strictly rejected.
3. **Structured & Safe Error Responses**:
   - Client responses never expose Node.js stack traces, SQL syntax, or internal filesystem paths. HTTP errors use `{ error: { code, message, requestId } }`; the request ID is also returned in `X-Request-Id`.
4. **Token Security at Rest**:
   - Both creator tokens and participant tokens are stored exclusively as SHA-256 hexadecimal hashes in SQLite. A compromised database backup does not yield active authentication secrets.

---

## 3. Known Security Boundaries & Trade-offs

1. **Guest Identity vs Permanent Accounts**:
   - In accordance with the VYUMI spec, invited friends join with **no account**. Participant identity is session-bound via localStorage. If a participant clears localStorage, they re-join with a new guest token. Older stored participant IDs without a token must rejoin as a new participant after this migration.
2. **SQLite Single-Node Storage**:
   - Rate limit counters in memory are node-local. For multi-node horizontal scaling, Redis adapter and centralized rate limiting (`REDIS_URL`) are introduced in Phase P4.
3. **URL Metadata Extraction**:
   - While SSRF protections prevent accessing internal networks, public ecommerce sites may employ anti-bot systems (Cloudflare, Akamai) that return 403 or captcha challenges. The app gracefully falls back to friendly manual product entry without crashing. DNS pinning protects each request destination; app level controls cannot guarantee network isolation from misconfigured host networking.
