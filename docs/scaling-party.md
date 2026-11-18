# Party performance and scaling

The measured prototype is a single Node/Express/Socket.IO process with SQLite WAL and persistent local disk. It does not prove horizontal scalability or internet latency.

The five-socket regression measures host-to-four-guests navigation and asserts every observed delivery below 300ms on localhost. Actual values are in party-latency.json.

The standalone benchmark seeds 100 parties with 6 members each, opens 600 WebSockets, and runs navigation, reactions, chat and room reads for 120 seconds. Tokens are real room-scoped credentials; seeding bypasses the UI/account-creation workload. It uses NODE_ENV=test to avoid the existing general REST test limiter; the party-specific reaction/suggestion/event limits remain active. Server/client run on the same laptop; startup/seeding is excluded from measured duration. Statistics are p50/p95/p99/max, not guarantees. No artificial transport/network delay is added.

Run `node scripts/load/party-benchmark.js --parties 100 --duration 120`. It writes party-load.json and exits nonzero on an error or if navigation p95 >=300ms or client REST p95 >=200ms.

Before optimization: navigation p95 1882.37ms, REST p95 2027.13ms; 29,077 operations, one client operation error (server HTTP errors were zero), roughly 89% of one CPU core on average. Raw report: party-load-before.json.

The observed bottleneck was repeated whole-room hydration and repeated SQL preparation in reaction handlers, amplified by overlapping vote/reaction broadcasts. The fix checks room expiry/product membership directly, reuses prepared statements per database connection without caching rows, computes disagreement from the current product vote rows, uses the existing authoritative vote delta, and bounds transient bursts.

After optimization: navigation p95 33.30ms (p99 400.38ms), REST p95 49.95ms (p99 243.89ms); 64,040 operations, zero errors; RSS 285.6MB and CPU user+system 39,140ms over 121.95 seconds (about 32% of one core on average). Maximum navigation was 1393.79ms and maximum REST was 1572.01ms: the long tail is not hidden by the passing p95 target. Raw report: party-load.json.

Indexes cover party_state(room_id), party_events(room_id,id), suggestions(room_id,product_id), results(share_id)/room_id, existing votes(room_id,product_id,participant_id), room_products(room_id,product_id), and account/participant lookups. Prepared statements belong to the exact DB connection and never reuse row results, so transactions, token revocation and migration/reopen behavior stay authoritative.

One process remains an explicit constraint. Before multiple instances: PostgreSQL-backed asynchronous repositories, shared uploads/object storage, distributed limits and presence, coordinated host grace deadlines, Redis Socket.IO fan-out and a verified transport/sticky-session strategy. SQLite file sharing or adding the adapter alone does not provide that architecture. Add deploy-level backups, TLS, monitoring and internet/load tests for the actual host before production.
