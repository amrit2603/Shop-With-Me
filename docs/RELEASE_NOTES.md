# Release verification October 29 2026

This is the current release record. Older phase reports in this repository describe earlier builds; use this file and README.md for the delivered state.

## Scope delivered

Feature 5 core journey plus the social-loop and quick-win sections of the supplied feature-ideas PDF. Existing React/Node/Socket.IO/SQLite architecture retained. New behavior includes private saved items, JSON wishlist export, source links, image download with a clear CORS failure state, WhatsApp handoff, valid QR codes, deadline selection/countdown, persistent chat emoji reactions, changed-vote confirmation, and PNG decision export. Existing templates, presence, typing, comments, uploads, optional AI and summary behavior remain.

Fixed broken pre-room URL preview; stopped fabricated ₹99 fallback prices; made screenshot uploads go through server validation before product creation; corrected USD/INR display mismatches; allowed all catalog items to be found; preserved failed comment drafts; removed invalid-identity restoration; resynchronized room snapshots on reconnect; fixed mobile overflow and hidden-tab content; corrected misleading hero sample data. Kept the existing visual system while repairing responsive layout, default-button styles, contrast and missing tokens.

Security changes require host authorization for additions/screenshots, block direct static access to chat files, omit query credentials from request logs, validate optional custom-product fields/finite prices/safe source URLs, enforce the attachment count without truncation, create the room-code unique index on fresh databases, bound long-lived caches, and fail startup on migration errors.

## Verified results

| Check | Observed result |
| --- | --- |
| Backend unit/integration | 178 passed in 16 files |
| Frontend unit/component | 33 passed in 4 files |
| Browser scenarios | 8 passed in Chromium; final run 45.9 seconds |
| Frontend lint | Exit 0, no warnings in final run |
| Production build | Passed; JS 398.28 kB / 124.19 kB gzip, CSS 57.26 kB |
| Standalone smoke | Passed: room, guests, votes, comments, chat, reconnect history, summary, final choice |
| Dependency audit | Zero known production vulnerabilities in backend/frontend; run again before release |
| QR | Rendered the delivered encoder's SVG and independently decoded the exact long room URL with jsQR |
| Backup and restore | Online backup, integrity check and isolated restore passed; restored 3 seeded rooms |
| Mobile | 375px room overflow assertion passed; desktop/mobile screenshots inspected |
| Clean backend installation | npm ci --prefix backend --ignore-scripts, then native SQLite query passed |

The screenshot API intentionally returns a relative `/uploads/...` URL by default. Its regression test was updated to assert that contract and still checks persisted magic bytes and rejects invalid files. Existing permission-dependent test clients now send the issued host token. No existing test was removed or its behavioral assertion weakened. The backend Vitest configuration uses the thread pool and an explicit .mjs extension.

## Local load evidence

Command: `node scripts/load/load-benchmark.js --rooms 50 --duration 20`

Node 24 on the user's Windows computer; SQLite WAL; one app process; 50 rooms, 10 participants each, 500 connected authenticated sockets; 20-second measurement. The test sets NODE_ENV=test and bypasses HTTP rate limits. Optional Redis and Ollama disabled. There are 50 concurrent REST connections to a hot room, plus participant votes, comments and chat broadcasts.

- 63,433 measured requests; approximately 3,119.5 requests/second reported by the benchmark.
- REST p50 12.57 ms, p95 28.43 ms, p99 45.47 ms.
- Chat fanout p50 25 ms, p95 56 ms, p99 419 ms; 5,000 observed deliveries.
- Zero recorded REST errors and zero mutation errors.
- Backend memory approximately 347 MB at the end.

This is a short local workload, not a sustained production guarantee or an independent multi-node test. It does not include TLS/network distance, slow clients, large uploads, disk failure, a giant historical database or AI inference. Earlier 2,000-user figures in historical documents are not current verification for this release. A preliminary run exited before completing socket setup and produced no result; it was not counted as successful. The completed 20-room and 50-room reruns passed.

## Production conditions still required

Select hosting/domain and configure HTTPS, exact origins, persistent local database/uploads, backups including file storage, monitoring/alerts, privacy/retention policy, and a deployed smoke test. Review the rights to sample product images/descriptions and the selected model/dependency licenses. Scan/moderate untrusted public uploads. Docker configuration, optional Redis and actual Ollama inference were not exercised here.

The implemented topology remains one application instance. PostgreSQL, shared object storage and distributed state/cache invalidation require implementation before horizontal scaling. The guest token model prevents token impersonation, not multiple nicknames by one human. Saved products are browser-local, and no account recovery or external merchant cart synchronization exists.

No public deployment, external messaging, account creation or purchase was performed. WhatsApp/native sharing prepares a handoff for the user; it does not send a message automatically.
