# VYUMI visual redesign — November 3, 2026

Tasks 1 and 2 delivered. Task 3 was not started and requires separate approval. This is a verified local prototype revision, not a production-readiness claim.

## What changed and why

The app now uses the supplied video direction: violet-grey backdrop, rounded near-black stage, warm gold highlights, white primary pills, restrained glass surfaces and self-hosted Manrope. The landing has centered name entry, a CSS liquid orb, an invitation form and an explicitly labelled decorative sample. Party product media/reactions are prominent, with actual online presence inside the stage. Comments/help start open, as approved by the user. Existing management controls, modes, transfers, suggestions, voting, chat, comments, saving, results and privacy controls remain.

- `frontend/src/theme.css`: one token source for palette, spacing, typography, radii, shadows, blur, avatar colors and canvas export typography. Existing component values were centralized to retain their layout contracts; semantic tokens lead new work.
- `frontend/src/World.css`, `index.css`, `CompactShop.css` and component/page CSS: consistent presentation across all routes and standard rooms. The outer stage uses overflow:clip, preserving sticky navigation. Blur is limited to navigation/landing overlays; unsupported backdrop-filter gets an opaque fallback.
- `components/DemoEntry.jsx`: decorative orb/sample and centered form composition; existing field names/actions remain.
- `components/party/PartyStage.jsx`, `ShoppingHostPanel.jsx`, `pages/RoomPage.jsx`: present existing socket presence, emoji reactions and default-open panels. No parallel presence or vote store was added.
- `utils/theme.js`, `utils/decisionCard.js`, `components/party/PartyResult.jsx`: both PNG exports read the same CSS colors/type. No external image-generation service.
- `backend/src/routes/parties.js`: public result and unavailable states share theme/World CSS, retaining escaping, HTTP statuses, metadata, privacy and links. `Dockerfile` copies these two source files into the runtime alongside dist.
- `frontend/public/fonts`: 164,700-byte Manrope variable font and OFL license. No runtime dependency added.
- `tests/e2e/live-party.spec.js`, `visual-theme.spec.js`: approved visibility migration was committed separately; additional assertions cover real presence, live party chat/comments, reduced motion, keyboard focus, contrast token pairs, 320–1440px entry and the mobile URL-form clipping regression.
- `scripts/capture-redesign.cjs`: temporary database and owned test server, reproducible screenshots/overflow checks and result export. Server/browser are closed on completion/failure.
- `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, ADR 0012, progress, audit and screenshot gallery: documented actual system and evidence. Local tooling sidecar is intentionally excluded from distributable source ZIPs.

## Audit and visual evidence

See [REDESIGN_AUDIT.md](REDESIGN_AUDIT.md) for requirement-by-requirement findings and exact line references at baseline commit `9e5b8c4`.

Open [REDESIGN_SCREENSHOTS.html](REDESIGN_SCREENSHOTS.html) locally for 16 surfaces/states at both 1280px and 375px, before/after, plus both downloaded result images. The original nine-surface baseline preceded edits. Additional states were recaptured from an isolated unchanged worktree at the same commit; the expanded baseline corrects the first mobile Votes capture, which had not selected Summary. The gallery includes landing, builder, URL/screenshot input, guest entry, party, chat, votes, invitation dialog, saved/empty, ready card, standard room, ended result, public result and room error. All capture runs use new test data, so invitation codes differ.

Inspected four frames from the supplied 2.65-second MOV in Downloads. Older screenshot attachments were not present in Downloads; they were not used as evidence of the current UI. No source ZIP was attached to this latest turn, so the existing clean source at the baseline commit was used.

## Fresh verification

| Command/check | Observed result |
|---|---|
| npm run lint --prefix frontend | Exit 0; Oxlint clean |
| npm run test:frontend | 4 files, 34 passed; 6.47s |
| npm run test:backend | 19 files, 230 passed; 35.26s |
| npm run build | 106 modules; JS 414.78 kB (129.24 gzip), CSS 103.38 kB (18.30 gzip) |
| npm run smoke | PASS: demo/session, live party, reactions, comparison/transfer, public result, legacy auth, rooms, guests, votes/comments/chat/reconnect and final choice |
| npm run test:e2e | 13 passed, 1.7m, no failed/skipped tests |
| node scripts/capture-redesign.cjs after | PASS: 16 surfaces × 2 widths + downloadable PNG; same baseline capture passed |
| Impeccable detect --json frontend/src backend/src/routes/parties.js | [] at completed-UI scan checkpoint; the two later CSS corrections were independently reviewed, without repeating the detector per the skill workflow |
| git diff --check | No whitespace errors |
| Old lime/purple literal search | No matches in frontend/src or public result route |

The final browser run includes four contexts: name entry, product shortlist, guest joins, synchronized navigation, real presence, reactions, product comments, room chat, comparison, transfer, isolated Explore, suggestions/group pull, ending, public result and revocation. Existing legacy-room, saving, attachment, QR, decision download and auth-boundary scenarios also pass. Vite emits ECONNABORTED proxy warnings while test browser contexts disconnect; the suite completed successfully. These warnings are recorded rather than presented as application failures.

The browser contrast check verifies the six declared foreground/background token pairs, not every rendered pixel or a formal accessibility certification. Entry tests cover nine widths from 320 to 1440px; all other captured surfaces have 320/375/1280px overflow assertions. The URL-entry regression separately checks actual button/panel bounds and unclipped text at 320/375px.

Compared with baseline: JS grows from 413.07 to 414.78 kB; CSS from 65.33 to 103.38 kB (gzip 12.11 to 18.30). The self-hosted font adds 164.7 kB on first load and is separate from the JS bundle. No WebGL/video runtime or UI dependency was added. Actual low-end hardware scrolling has not been profiled.

## Independent design review

Impeccable finish reviewer inspected all requested captures and the pinned reference, with no inherited build conversation. It requested two material fixes: the 375px URL action clipped at the panel edge, and the ranking disclosure looked like a native gray rectangle. Fixed the responsive row and secondary control styling, added the clipping regression, and recaptured the same surfaces.

The follow-up reviewer scored both fixes **resolved**, disposition **ship at the scored-fix scope**. It did not independently rerun runtime tests or certify the whole app. The separate documenter wrote DESIGN.md and the token-bearing design sidecar from the actual source.

## Evidence and tools

Used Impeccable context, direction seed (pinned brief takes precedence), craft floor, mechanical scan, independent finish review and documentation; Ponytail for preserving existing components/behavior and avoiding new dependencies; Gravitas for scoped audit/planning/evidence; existing Playwright/Vitest/Oxlint/Vite; ffmpeg for video frames. No Mobbin/Firecrawl lookup was needed for this local attached-reference task.

## Run and limits

Stop any older app terminal with Ctrl+C. Extract the new source archive into a new folder and double-click `Start-Vyumi.cmd`. Keep its terminal open and visit http://localhost:3001. Alternatively: `npm run setup`, `npm run build`, `npm start`. A Node installation and internet for initial dependency installation are required. Existing user data was not migrated or deleted; capture/test databases were temporary.

No real production deployment, Docker image build, new load run, cross-browser/mobile-hardware test, exhaustive accessibility audit or live model call was performed. SQLite, presence, host timers and rate limits remain single-instance. The host is deterministic; gallery catalog data still has one image per product, and variants/six-sneaker party remain absent. The source ZIP contains the launcher, all lockfiles, source catalog, shared presentation files, font/license and screenshot evidence; it excludes dependencies, dist, runtime databases, credentials and uploads.

Recommended next step, after approval: Task 3's synthetic sneaker catalog with owned/placeholder multi-image variants, then catalog-host brand grouping and fact-based answers. Presence inside the stage was already part of Task 2 and is now implemented. Distributed deployment remains a separate engineering task.
