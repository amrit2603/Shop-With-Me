# Live Shopping Party prototype — November 2, 2026

Latest UI update: the compact product/chat view, Manage party, Help me choose and Leading label are documented in SIMPLE_UI_REPORT.md. Its final verification passed 34 frontend tests, 10 browser scenarios, lint, build, smoke and an empty UI scan. Backend code was unchanged; the clean-source backend/load evidence below is from the prior implementation checkpoint.

The latest request changes hosting to name-only demo entry. No signup/login form is shown; old sign-in links redirect to the homepage. A unique opaque server session protects the creator rather than using a shared public demo password. React/Vite, Node/Express, Socket.IO and SQLite are retained.

## Delivered prototype
Synchronized product/gallery stage; Host/Explore modes; guest suggestions and bring-everyone action; participant avatars/presence; four mapped vote reactions with replacement/removal and transient bursts; existing comments/chat/attachments/private saved finds; transferred and automatic fallback host control; deterministic catalog-host questions, disagreement, comparisons, shortlist suggestions and group summary; ended-party write rejection; public revocable/first-name-only result page with social metadata and image download.

## Verification
Clean-source install and verification passed: 230 backend tests across 19 files, 33 frontend tests, and all 10 browser scenarios. No tests failed or were skipped. Lint, production build, both production audits (zero vulnerabilities), and the expanded smoke passed. After the final ranking edge fix, backend coverage/tests and smoke passed again from the clean copy. The Impeccable scan returned no findings on changed UI.

V8 coverage for backend services/store/routes: 82.01% statements, 84.41% lines, 86.47% functions, 71.06% branches. Statement/line coverage exceeds 80%; branch coverage does not. The catalog-host suite has 17 golden/edge cases and the party suite has 23 cases. Deliberately breaking host permission and score arithmetic caused the expected failures; the temporary source was restored byte-for-byte. See party-mutation-checks.txt.

The latest name-only prototype core is delivered. Broader production work remains partial: multi-instance coordination, deployment/ops, higher branch coverage, and the synthetic six-sneaker party seed. This does not claim completion of every requirement in the earlier nine-phase production plan.

The public result and full party stage were visually captured on desktop and at 375px. The automated 4-context journey performs name entry, shared navigation, reactions, comparison, transfer, Explore/suggestions, ending, public page and revocation. The five-client latency regression asserts the other four clients receive host navigation under 300ms; actual samples are saved to party-latency.json.

## Load measurements
100 parties × 6 participants, 120-second sustained localhost workload. Before: 29,077 operations; one client operation error; navigation p95 1882.37ms; REST p95 2027.13ms. After query/statement/broadcast optimization: 64,040 operations; zero errors; navigation p50/p95/p99 2.53/33.30/400.38ms; REST p50/p95/p99 6.79/49.95/243.89ms. End RSS 285.6MB. Both p95 targets passed; max latencies exceeded one second. See party-load-before.json, party-load.json and scaling-party.md.

## Explicit limits
This is not a company production deployment or a security certification. SQLite, presence, host-grace timers and rate limits are single-instance. Internet latency, TLS/deployment, distributed rate limits and host failover across processes remain unverified/unimplemented. Demo names do not verify identity; losing cookies loses creator access. No email recovery or account verification is offered.

The shopping host uses deterministic real catalog facts, not a general-purpose LLM. Missing specs stay unknown. Suggestions remain inside the shortlist. New merchant discovery, video/voice, multi-brand tenancy, the six-sneaker party seed and a fully rewritten operations system are not supplied. Existing demo catalog rights/current prices have not been commercially verified.

No production claim follows from local tests. See FEATURE_STATUS.md for the requirement mapping and DEMO_TECH.md for the review questions.

## Start
Extract a fresh copy, use Node 24 LTS, then double-click Start-Vyumi.cmd; keep the terminal open. Or run npm run setup, npm run build, npm start. Visit http://localhost:3001, enter a name, choose Start Shopping Party, shortlist products, create the room, then share its link. Stop with Ctrl+C. The ZIP excludes dependencies, build output, DBs, uploads, credentials and local authoring tools.
