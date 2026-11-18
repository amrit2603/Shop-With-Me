# Scaling the delivered application

The current release uses one Node application and one SQLite database on a persistent local disk. It has transactions, a unique vote key, foreign keys, supporting indexes, WAL mode, bounded room caches, small Socket.IO events and debounced deterministic summaries. The current measured evidence is in RELEASE_NOTES.md: 500 connected guests across 50 rooms for 20 seconds.

## Single-instance operations

Use a persistent disk with space monitoring for both SQLite and uploads. Keep SQLite on local disk rather than a network filesystem. Terminate HTTPS at a trusted reverse proxy; explicitly configure the public frontend origin. Set proxy trust only for a known ingress topology; do not blindly trust arbitrary forwarded headers. Use online SQLite backups and snapshot the uploads volume, retain copies off-host and drill restores. Alert on health failures, elevated 5xx, latency, disk pressure and restarts. The repository provides scripts and liveness endpoints; hosting schedules and alerts are not configured automatically.

## What the repository boundary does

The room repository wraps synchronous SQLite methods. It is a useful boundary, not a completed PostgreSQL adapter. Some routes/services still call getDb directly. Replacing the adapter with asynchronous methods also requires updating and awaiting their call sites, transactions, token validation, startup and socket handlers. No PostgreSQL implementation is included.

## Before multiple instances

1. Implement PostgreSQL migrations and async repository/services. Preserve the compound vote uniqueness and transactional quota checks. Move money to integer minor units in that migration.
2. Replace local upload files with private shared object storage and short-lived authorized downloads. Test room expiry, deletion and quota enforcement together with database transactions.
3. Use the optional Socket.IO Redis adapter with distributed rate limits and resilient presence leases. Add cross-instance cache invalidation and test summary ordering after simultaneous changes. The current in-process caches cannot coordinate that topology.
4. Decide session affinity for polling or enforce a tested WebSocket-only deployment. Exercise reverse-proxy timeouts and reconnects under rolling restarts.
5. Run a sustained load test through the actual ingress with realistic room sizes, cold reads, mutations, uploads and slow clients. Record p95/p99, failures, memory, CPU, disk latency and recovery. Test Redis/Postgres outages, backup restores and graceful drain.

Redis alone does not make independent SQLite instances coherent. The optional adapter code is retained but was not tested with Redis in this release. Do not advertise the application as horizontally scaled until the shared-storage and invalidation work above is implemented and verified.
