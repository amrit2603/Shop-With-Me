# Invite, party and compact votes — November 3, 2026

The initial landing composition is preserved. After pasting a code/link, the invitation remains visible in a single panel, the name field receives focus, and Join Room enters that invitation. Direct invitation links use the same name step. No email/password or repeated room-code entry.

## Changes by file

| File | Change |
| --- | --- |
| frontend/src/pages/HomePage.jsx | Keep pending invitation in landing route state instead of going through the room guard and losing the input. Signed-in users still join directly. |
| frontend/src/components/DemoEntry.jsx | Retain typed invitation, focus name without scrolling, show a compact invited-only step, keep name errors/retry, allow updating the invitation. Initial landing copy/composition retained. |
| frontend/src/components/home/RoomReadyCard.jsx | Put native Share and WhatsApp in a spaced action group with separate icons; keep checked code/link copying and direct invite URL. |
| frontend/src/components/Navbar.jsx | Apply existing menu action styling to Leave demo, centered with a full-width target. |
| frontend/src/components/party/useParty.js | Preserve independent gallery state on unrelated updates/host exploration; clear local views when host navigation, explicit regroup, mode change or transfer requires it. Individual follows only override the view in Explore. Explicit product links remain usable until the host navigates. |
| frontend/src/components/party/PartyStage.jsx | Add host Previous/Next product controls and clear host/guest instructions. Reuse one member picker for follow/transfer, remove duplicate per-member Follow and duplicate transfer picker. Host/Explore, unfollow, suggestions, tips and end remain available in Manage party. Product additions unchanged. |
| backend/src/services/partyFollowing.js | Add room-scoped regroup that clears follow edges while preserving members/views. |
| backend/src/partySocket.js | Broadcast regroup when bringing everyone to a suggestion, transferring host or returning to host mode. Every host-mode navigation forces all viewers to the selected product, even if it is the same shared product. Existing server permissions/validation retained. |
| frontend/src/components/room/RoomProductCard.jsx | Reuse existing card with optional compact presentation. Name/image/price/votes visible; all specs, author/voters/source/share/save/comments remain in expandable details for sidebar cards. Ordinary product detail cards remain expanded. |
| frontend/src/components/room/RoomSummaryPanel.jsx | Select compact card presentation in Votes; ranking/final choice and winner logic retained. |
| frontend/src/World.css | Existing tokens for invited step, separated share actions, centered logout, host controls and compact vote rows. Bound the vote list height with scrolling rather than expanding the entire sidebar indefinitely. Mobile layout and focus states retained. |
| frontend/tests/partyView.test.jsx | Regression for deep link vs host view, reaction updates, independent galleries, follows, forced regroup and transfer. |
| backend/tests/following.test.js | Regression for room-scoped regroup preserving members and not touching another room. |
| tests/e2e/tab-room-fixes.spec.js | Link/code retention and joining, name focus and mobile visibility, separated share actions, compact cards/expandable full data/bounded scroll, centered identity action, existing tab/save/comment/follow assertions. |
| tests/e2e/live-party.spec.js | Exercise host Next/Previous, single-picker transfer, regroup while following, host mode and host reload; preserve four-user reactions/chat/comments/explore/results. |

Existing test-contract changes are in separate commits, explicitly reflecting the user's requested compact cards and single member picker. No scenarios skipped or removed.

## Checks

- Backend: 234 tests passed across 20 files.
- Frontend: 43 tests passed across 9 files; lint clean.
- Full Chromium suite: 14 passed (1.6 minutes), including four-party synchronization and same-browser multi-user acceptance. Console/page error assertion passed.
- Production build passed: 107 modules; CSS 107.98 kB, JavaScript 400.83 kB (gzip 19.11/123.39 kB).
- Smoke passed: identity, rooms, guests, votes, comments, live chat/history, synchronized party, transfer and result.
- Reviewed rendered desktop/mobile invitation, share card, host/guest stage, compact votes and identity menu. Invited-only view was tightened after the first visual review; the initial landing remains unchanged.

Latest gallery-only adjustment receives an additional affected browser run after the full suite. See SIMPLIFIED_PARTY_VERIFICATION.txt for the final result.

## Evidence and limits

Screens: docs/screens/simplified-invite-name.png, simplified-invite-mobile.png, simplified-identity-menu.png, tab-fixes-share-card.png, tab-fixes-room-1280.png, tab-fixes-votes-375.png, compact-party-default.png and compact-party-mobile-default.png.

Mobbin refused the reference search because its MCP requires a paid plan. No Mobbin screenshots or precedent claims are used. Implementation follows the existing design and requested workflow. Impeccable mechanical scan and rendered checks supplement the executable checks.

Native Share URL/cancellation/fallback and clipboard readback are tested; real device share sheets and mobile on-screen keyboards are not physically tested. There is no video-call/screen-stream feature: the shopping party synchronizes the selected product/gallery and supports existing reactions/chat. Backend remains one instance using SQLite and transient presence. No deployment or load certification in this task. Localhost invitation links require a reachable hosted origin to work on another computer.
