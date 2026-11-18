# Tab and room fixes — November 3, 2026

The later request restores the preceding rounded landing, native Share and clickable code. Those landing/share rows below describe the earlier checkpoint; see LANDING_SHARE_RECHECK.md for current behavior.

This changes the eight requested areas in the existing app. Room product-add endpoints, persistent votes/comments/chat, vote arithmetic and the underlying stack are retained. No new runtime dependency was added; the QR dependency was removed.

## Acceptance checklist

| Requested check | Result | Evidence |
|---|---|---|
| Landing fills the screen | PASS | Browser asserts x=0, width=1280, height≥900; mobile overflow and screenshots; no outer landing margin/max-width |
| Share card has only WhatsApp and Copy link | PASS | Exactly one copy button plus WhatsApp link; no QR/code-copy/native-share controls. Modal Close remains dismissal; standard-room entry is outside the share card |
| New tab starts at landing, not logged in | PASS | Same browser context with shared cookies; also tests an inherited duplicate-tab session. Room/product links require name entry |
| Two tabs can be different users in one room | PASS | Amrit/Blair stay independent across joins, reloads and another tab's logout |
| Follow, unfollow and choose person sync live | PASS | Follow another member's independent product view; follow updates appear in the other member's roster; unfollow; assign host and transfer back; leave clears follow. Backend rejects self/offline/cyclic/cross-room targets |
| Save for me is private; shortlist/votes shared | PASS | User/room-scoped sessionStorage; Amrit's saved item is absent from Blair's list. Shared room/vote workflows remain on the existing backend |
| Saved items give a link | PASS | Saved–copy-link confirmation copies /room/:roomId/product/:productId. A new named guest opens that specific product without changing the group's current product |
| Comments post, persist and sync | PASS | Amrit posts with Enter; Blair receives it live and after reload, with author/time. Empty Post is disabled. Existing backend validation and storage retained |
| Help me choose takes ≤3 questions | PASS | Budget, priority, must-have; three taps produce one top choice and two alternates in a three-product room; Start over resets to question 1 |
| Vote section shows complete product cards | PASS | Image/name/price/source/specs/adder/voters/counts/comments/actions and Winner; existing weighted winner calculation retained |
| No console errors | PASS | Acceptance flow records page errors and error-level console messages in all its tabs and asserts an empty array |

When fewer than three products match the answers, the helper returns the available matches, or an honest empty result. Missing prices/specifications/merchant URLs are not invented. Buy/View opens the merchant when supplied, otherwise the app's provided product details with a visible merchant-link-unknown label. The demo catalog does not establish merchant inventory or independently verified quality.

## What changed in each file

Paths are relative to the project root.

| File | Change |
|---|---|
| backend/src/services/accountSessions.js | Explicit tab-session header takes precedence; invalid/anonymous headers never fall back to another tab's cookie. Legacy cookie clients remain compatible |
| backend/src/routes/auth.js | Successful demo/register/login returns the opaque session token for per-tab storage; other tabs' sessions are not selected by shared cookies in the React client |
| backend/src/server.js | Allows the tab-session header in configured CORS requests |
| backend/src/logger.js | Redacts the new session credential/header |
| backend/src/services/partyFollowing.js | Transient room-scoped member views/follows; rejects self/offline/cyclic targets; clears followers on departure; null-prototype records avoid inherited property targets |
| backend/src/partySocket.js | Validated view/follow events, peer broadcasts and final-socket cleanup. Explicit matching room leave and disconnect preserve host handoff; unrelated room-leave payloads are ignored |
| backend/src/store/roomStore.js | Exposes the actual creator display name for Added by. Existing product additions are creator-authorized; legacy unknown creators retain an honest generic label |
| frontend/src/services/tabSession.js | Shared authenticated fetch helper uses this tab's token, or an explicit anonymous marker |
| frontend/src/services/auth.jsx | Per-tab user/token restoration, duplicate-session ownership detection, local logout cleanup and return to landing. BroadcastChannel carries coordination IDs, never authentication tokens |
| frontend/src/services/api.js | Room/API requests use the tab session; creator credentials move from localStorage to sessionStorage |
| frontend/src/App.jsx | Guards room, product-detail and saved routes with name entry; retains an intended destination for after entry |
| frontend/src/pages/HomePage.jsx | Returns to intended room/product after entry; creator IDs/tokens are tab-scoped; marks landing for full-size presentation |
| frontend/src/components/DemoEntry.jsx | Invite visitors enter their own display name through the existing landing form; demo entry remains available |
| frontend/src/pages/RoomPage.jsx | Tab-scoped room/participant state, explicit Leave room / Log out, product deep-link selection, complete vote-card data/callbacks |
| frontend/src/components/Navbar.jsx | My saved navigation label |
| frontend/src/World.css | Full viewport landing only; member/follow controls, simple questions, complete cards and leave action. Mobile image accommodates all four reactions above bottom navigation |
| frontend/src/components/home/RoomReadyCard.jsx | Two share actions, display-only code, honest copy confirmation/error; no QR/code copy/native-share. Room entry outside the card; Close retained for dialogs |
| frontend/src/components/home/RoomReadyCard.css | Removes obsolete QR styles |
| frontend/src/utils/qrCode.js | Deleted unused QR generation logic |
| frontend/package.json | Removes qrcode-generator |
| frontend/package-lock.json | Matching dependency removal; no new dependency |
| frontend/src/utils/clipboard.js | Shared Clipboard API/selection fallback, checked success, focus restoration, honest failure |
| frontend/src/utils/savedProducts.js | Personal saves keyed by user ID and room ID in sessionStorage, deep links and existing exports/downloads retained |
| frontend/src/components/ProductActions.jsx | Personal save, Saved–copy-link, My saved, safe source/detail links, copy/share actions. No room/vote mutation on save; derives the indicator and feedback from the current product/room to prevent stale state |
| frontend/src/pages/SavedPage.jsx | Explains tab-private storage, logout/close behavior and export |
| frontend/src/components/ProductComments.jsx | Reuses the persisted thread; Enter posts, Shift+Enter retains newline, author/time, chronological order and optional initially open form |
| frontend/src/components/party/PartyStage.jsx | All members access Manage party; member states, follow/chooser/unfollow and existing host controls. Reuses ProductComments and personal actions below details; retains navigation/reactions/suggestions |
| frontend/src/components/party/useParty.js | Peer subscriptions, own view publication, followed view resolution, deep-link selection and tab-authenticated party start |
| frontend/src/components/party/ShoppingHostPanel.jsx | Replaces complex assistant UI with three tappable questions, recommendation/alternates and Start over |
| frontend/src/utils/recommendProducts.js | Pure catalog-based filtering/ranking, budget/must-have handling and factual reasons without invented quality claims |
| frontend/src/components/party/PartyResult.jsx | Result/sharing requests use the current tab's session |
| frontend/src/components/room/RoomProductCard.jsx | Complete card metadata/actions, actual voters/comments, source/specs and Winner; unique IDs per display instance; avoids duplicate description text |
| frontend/src/components/room/RoomSummaryPanel.jsx | Renders the existing product card for every product in Votes, wired to the same authoritative vote/comment actions |
| backend/tests/auth.test.js | Shared-cookie/tab-header isolation and logout regression |
| backend/tests/party.test.js | Authenticated follow/view, self/cycle/cross-room rejection, matching/unrelated explicit leave and departure cleanup |
| backend/tests/following.test.js | Follow graph, prototype-key rejection, room isolation and empty-party cleanup |
| frontend/tests/selection.test.js | User/room save isolation, deep links, removal, unknown prices, filtering and honest recommendation text |
| frontend/tests/productActions.test.jsx | Regression for save indicators when changing products/rooms |
| frontend/tests/clipboard.test.js | Clipboard refusal fallback, focus preservation and refusal to report failed copy as successful |
| tests/e2e/account-helper.js | Host fixtures use explicit tab entry; API account fixtures return their own credentials |
| tests/e2e/identity.spec.js | Replaces cross-tab remembered-user assumptions with mandatory name entry; retains independent identity assertions |
| tests/e2e/room-name-and-code.spec.js | Replaces removed QR/code-copy expectations with the exact two sharing actions and Copied confirmation; room entry remains tested |
| tests/e2e/live-party.spec.js | Migrates to the three-question helper and reused comment form; retains four-client navigation/reactions/transfer/Explore/end/share flow |
| tests/e2e/quick-wins.spec.js | Explicit host tab credentials, same-tab private saved view, scoped card assertions after adding full vote cards |
| tests/e2e/room-collaboration.spec.js | Checks initially open comments and scopes main-thread assertions; retains voting/chat/final choice |
| tests/e2e/tab-room-fixes.spec.js | New same-browser acceptance journey, duplicate-session check, privacy/deep links, follows/assignment/leave, comments, recommendations/cards and console-error assertion |
| scripts/capture-redesign.cjs | Captures private saves in the owning tab; names the empty-list/error fixture explicitly under the new route guard |
| AGENTS.md | Records tab identity and explicitly removed QR contract for future changes |
| PRODUCT.md | Updates personal-save/tab-session constraints |
| DESIGN.md | Records full-size landing and current controls without changing the established visual world |
| README.md | Links this current report and removes the obsolete QR dependency note |
| docs/party.md | Documents tab sessions, follow events, sharing, personal saves and simplified help |
| docs/FEATURE_STATUS.md | Points older historical status claims to this checkpoint |
| docs/TAB_ROOM_FIXES.md | Scope, caller map and verification contract |
| docs/TAB_ROOM_FIXES_REPORT.md | This acceptance/file-by-file report |
| docs/PROGRESS.md | Current checkpoint and actual gate results |
| docs/party-latency.json | Updated by the existing backend latency regression, not a new load benchmark |
| docs/screens/tab-fixes-*.png | Current requested-feature screenshots; other existing screenshot paths are refreshed by regression tests |

## Verification and test migrations

The existing browser suite was retained. Contract assertions were migrated because the user explicitly removed QR/code-copy, disallowed remembered cross-tab identity, requested visible detail comments, and replaced the complex helper. Product/voter/thread assertions are scoped to the intended section because complete cards also exist in Votes; feature assertions remain. Backend host comparison APIs retain their existing regression tests and smoke coverage.

The implementation keeps room products as the shared shortlist and reuses the votes table and comments. Personal save has no shared mutation. No new voting system, merchant discovery service, account system, database engine or product-add flow was built.

Final results: frontend 39/39, backend 233/233, browser 14/14 (1.4m), lint/build/smoke passed. Command evidence and the mechanical scan checkpoint are recorded in TAB_ROOM_FIXES_VERIFICATION.txt. The initial full sweep exposed reaction overlap, duplicate hidden-card test selectors and the clipboard fallback; these were corrected. A parallel verification run lost its local test servers; final release gates were rerun sequentially rather than counting that run as a pass.

## Practical limits

Personal saves and identity survive reload within their tab; logout or closing the tab clears them. Export saved items before doing so. Previous unscoped localStorage saves are ignored, not assigned to whichever user logs in next, and are not deleted.

Following tracks a member's room product/gallery view, including product-detail links; it does not share private saved pages or unrelated browsing. Views/follow state are transient on the existing single backend process. SQLite/presence/timers remain single-instance; no new deployment, load test, real-phone profile or cross-browser certification is claimed.

The console-error result covers the exercised Chromium acceptance flow. WhatsApp verification checks the encoded invitation URL/short message and target link; no WhatsApp message was sent. Unknown catalog merchant URLs remain visibly unknown, with internal product details as the available View action.

Run from a fresh extracted source folder with Start-Vyumi.cmd, or npm run setup, npm run build, npm start. Stop an older running copy with Ctrl+C first.

## Current screenshots

[Full-size desktop landing](screens/tab-fixes-landing-1280.png), [mobile landing](screens/tab-fixes-landing-375.png), [two-action share card](screens/tab-fixes-share-card.png), [live Manage party](screens/tab-fixes-manage-party.png), [simple recommendations](screens/tab-fixes-recommendations.png), [desktop room/votes](screens/tab-fixes-room-1280.png), [complete mobile vote cards](screens/tab-fixes-votes-375.png). Screenshots were inspected; the Manage-party capture was changed to a document-top full-page capture so sticky navigation does not conceal the stage header.
