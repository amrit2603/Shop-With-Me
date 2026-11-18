# 8. Backend Scalability Architecture & Storage Abstraction

Date: 2026-10-29

## Status
Accepted

## Context
VYUMI Feature 5 uses SQLite (`better-sqlite3`) as the storage engine on a single Node.js process. While SQLite provides microsecond read latencies and robust ACID transactions for prototyping, production scaling to hundreds of concurrent rooms with multiple server instances requires:
1. Swappable database layer (PostgreSQL compatibility without touching route handlers)
2. High-efficiency broadcast protocol (delta events instead of full-room reloads)
3. Debounced decision summary computations (150ms debounce with version caching)
4. Horizontal scaling compatibility (stateless app tier with optional Redis adapter)
5. Strict resource protection (ETag caching, query timeouts, graceful connection draining)

## Decisions
1. **Repository Abstraction (`RoomRepository`)**:
   Introduce a clean interface decoupling Express routes and Socket.IO handlers from SQLite queries. SQLite implementation uses prepared statements and transactions; migration to Postgres requires implementing the repository methods without modifying route or socket code.
2. **SQLite Performance Pragmas & Indexes**:
   Configure WAL mode, `synchronous = NORMAL`, `busy_timeout = 5000`, and memory cache. Add covering indexes for top queries (`idx_room_messages_room_created`, `idx_votes_covering`, `idx_rooms_expires_at`).
3. **Delta Event Broadcasts & 150ms Summary Debounce**:
   Emit lightweight mutation deltas (`vote:updated`, `comment:added`, `chat:message`, `participant:joined`). Debounce decision summary calculations per room to at most once per 150ms using a room version counter.
4. **ETag & Resource Safeguards**:
   Add weak ETag caching to static product catalog endpoint (`304 Not Modified`). Implement 15s request timeout and graceful shutdown sequence (sockets drained -> HTTP closed -> DB closed).
5. **Horizontal Scaling & Redis Adapter**:
   Support `@socket.io/redis-adapter` when `REDIS_URL` is set, falling back to in-memory adapter on single-node deployments.

## Consequences
- High-concurrency vote/comment bursts no longer cause database query storms.
- Load testing with Autocannon verifies REST and fan-out latency targets (REST p95 < 200ms, fan-out < 300ms).
- Clear, documentable path to PostgreSQL migration recorded in `/docs/scaling.md`.
