# VYUMI Shop With Me

## Product summary
Collaborative shopping rooms let a creator shortlist products and invite guests to vote and comment. Feature 5 also calls for persistent live room chat, summaries, and a creator's final choice.

## Stack and commands
- Node.js, Express 5, Socket.IO, better-sqlite3; React 19, Vite, Vitest.
- `npm install --prefix backend && npm install --prefix frontend`
- `npm run backend`, `npm run frontend`, `npm run test:backend`, `npm run test:frontend`, `npm run build`

## Architecture pointers
- HTTP app: `backend/src/server.js`; Socket.IO: `backend/src/socket.js`.
- SQLite schema: `backend/src/db/database.js`; queries and mutations: `backend/src/store/roomStore.js`.
- Routes: `backend/src/routes/`; decision scoring: `backend/src/services/decisionSummary.js`.
- React pages: `frontend/src/pages/`; reusable UI: `frontend/src/components/`; API and socket clients: `frontend/src/services/`.

## Hard rules
- Backend is authoritative for validation, permissions, limits, and vote arithmetic. Persist every action.
- Votes are calculated in code. Optional AI may only summarize structured counts and comments; validate its output and never trust it for product facts. App must work without AI.
- Public URL ingestion only; never bypass authentication or CAPTCHA. Defend against SSRF and redirects to non-public hosts.
- Never weaken or remove an existing test to get a green run. Report real command output and counts.
- Do not commit secrets, `.env`, SQLite databases, `node_modules`, or build output. Keep `.env.example` complete.
- Record design and architecture decisions in `/docs/decisions/`; update `/docs/PROGRESS.md` at each phase.
- Keep the stack and prefer small changes; no microservices, Kubernetes, or GraphQL.
- Use Conventional Commit messages on `feat/final-polish` when Git is initialized.

## Delivery requirements
Follow the user's Feature 5 brief in full, including expiry, identity tokens, live chat, security hardening, tests, accessibility, load evidence, demo guides, scaling notes, and clean packaging. Do not label an item complete unless its required gates pass.
