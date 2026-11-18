# P4 Load Test

## Scenario

- Host: Windows x64, Node.js 24.15.0, better-sqlite3 13 with WAL.
- Harness: `scripts/load/load-benchmark.js`; Autocannon drives 50 concurrent REST readers while Socket.IO clients exercise the room flow.
- Scale: 200 rooms, 10 authenticated participants per room, one product per room, and 2,000 WebSocket clients. Each participant casts a vote, posts a comment, and sends a chat message. The ten participants in each room act together; rooms are spread across the 120-second window.
- Metrics: Autocannon request callbacks record end-to-end REST latency; socket message receive timestamps record fan-out latency. The backend's local-only load metrics endpoint records HTTP status errors, process CPU time, and memory. `NODE_ENV=test` disables rate-limit counters only in this isolated benchmark process.
- Baseline source: P3 commit `b52b560` (before delta broadcasts, summary debounce and cache). Optimized source: P4 implementation with the bounded room snapshot cache, summary cache and delta broadcasts. Both use the same harness and schedule. Results are single runs on this development machine, not production capacity guarantees.

## Results

| Metric | P3 baseline | P4 optimized | Change |
|---|---:|---:|---:|
| REST p50 | 129.7 ms | 15.3 ms | -88% |
| REST p95 | 536.4 ms | 30.4 ms | -94% |
| REST p99 | 1,635.1 ms | 52.6 ms | -97% |
| REST throughput | 264.2 req/s | 2,702.5 req/s | 10.2× |
| REST errors | 0 | 0 | — |
| Socket fan-out p50 | 241 ms | 20 ms | -92% |
| Socket fan-out p95 | 2,094 ms | 38 ms | -98% |
| Socket fan-out p99 | 3,377 ms | 89 ms | -97% |
| Fan-out deliveries | 20,000 | 20,000 | same sample count |
| Peak process RSS | 398.9 MB | 539.6 MB | +35% |
| Process CPU time | 112.2 s | 126.0 s | +12% |

REST p95 and fan-out p95 met the stated targets (<200 ms and <300 ms) in the optimized run. Both runs completed 2,000 votes, 2,000 comments, 2,000 messages and zero HTTP or mutation errors. Peak memory increased because the optimized run retains a bounded cache and 2,000 active socket connections; the 500-entry room and summary caches bound cache growth, but this workload used about 540 MB RSS. This is a material single-node resource cost.

The first measured bottleneck was repeated room reconstruction, summary calculation and accumulated-comment reads during bursts. P4 now sends deltas rather than full room snapshots, debounces summary recomputation for 150 ms per room, caches room snapshots and summaries by room version, and no longer reads all comments when a new comment is written. The same 200-room scenario improved REST p95 from 536 ms to 30 ms and fan-out p95 from 2.09 s to 38 ms.

## Reproduction

From the repository root, with backend dependencies installed:

```sh
npm run load
```

The default run uses 200 rooms and 120 seconds. `LOAD_ROOMS` and `LOAD_DURATION_SECONDS` can reduce the workload for a quick local calibration. The script creates a temporary SQLite database and removes it after the run. The optional Redis path was not exercised because no Redis service was available; the benchmark intentionally uses the in-memory single-node adapter.
