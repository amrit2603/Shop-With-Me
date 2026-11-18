# Product help, separate comments and explicit chat tags

November 3, 2026. Scope follows the latest request: leave the initial page, invitations, party navigation/management and vote layout alone. The user withdrew the direct end-party change; existing host-only End party remains in Manage party.

## Current workflow

- Product details shows its description, Save for me, Buy/View product, and More. More keeps My saved, product details, copy/share and image download available without displaying every action at once.
- Product help restores Ask about this product and Compare with another product. Comparison uses the viewed product and one other shortlisted product. Questions/compares reuse the existing factual catalog host, including honest unknown details. The three-question Help me choose selector remains optional and collapsed.
- Product comments is a separate small thread, named for the displayed product, with author/time, newest at the bottom, a short input and Post comment/Enter. Empty comments remain blocked. New comments scroll to the bottom. The thread is bounded to 180px and the composer stays outside its scrolling area.
- General chat tags only a product explicitly selected in the composer. No product tag and omitted productId persist null, even during a live party. Tagged messages still work, and clearing the picker removes the next message's tag.

## Changed files

| File | Change |
| --- | --- |
| backend/src/socket.js | Remove automatic party.currentProductId fallback from chat:send. Preserve validation, live broadcast, attachments, reactions and history. |
| backend/src/partySocket.js | Allow an optional displayed productId for product help; verify it belongs to the bound room before answering. This lets Explore-mode questions refer to the product the person is viewing, without changing the shared view. Comparison and server authorization are reused. |
| frontend/src/components/party/ShoppingHostPanel.jsx | Restore question form, one-select comparison and result/table/dismissal using existing socket support. Keep the three-question selector in a collapsed optional disclosure. Automatic disagreement tips do not fill the question-answer area. |
| frontend/src/components/party/PartyStage.jsx | Separate product details, product help and product comments. Pass existing send/reply handlers to the helper; enable compact actions/comments only in the live stage. Navigation/management/host/end behavior untouched. |
| frontend/src/components/ProductActions.jsx | Optional compact presentation with Save/View/More; secondary actions reuse the same handlers. Default presentation remains for ordinary product cards/saved products. |
| frontend/src/components/ProductComments.jsx | Optional compact thread/composer, scroll new messages to bottom, clearer comment placeholder, accessible post errors. Existing comment API, sorting, validation and labels retained. |
| frontend/src/components/party/PartyStage.css | Local styling using existing tokens for separated product tools, compact actions, comparison and bounded comment thread; responsive layouts. No theme/landing CSS changes. |
| backend/tests/party.test.js | Live-party null/omitted/selected/cleared tag persistence; displayed-product questions in Explore, cross-room rejection and comparison. |
| frontend/tests/chatPanel.test.jsx | Default and explicitly cleared picker send productId:null. |
| frontend/tests/productHelp.test.jsx | Viewed-product question context, trimmed/empty questions, comparison, one-product/offline cases, result dismissal and no unsolicited disagreement panel. |
| tests/e2e/live-party.spec.js | Real four-user explicit tag/no-tag history/reload, restored questions/comparison, separate comments, More disclosure, optional selector, desktop/mobile tool captures. All existing party/transfer/explore/results assertions retained. |
| tests/e2e/tab-room-fixes.spec.js | Migrate comment selectors to the separate thread and open optional quick choice before its existing assertions. Private-save/follow/invite/vote/privacy checks retained. |

Test-contract migrations are separate commits with the reason recorded. No scenario was skipped or removed.

## Evidence

Backend 236 tests passed in 20 files (30.74s, --maxWorkers=2); frontend 47 tests passed in 10 files after final UI refinement; lint and production build passed. Full Chromium suite:14 passed (2.1m), including tagged/untagged chat across four users and persisted reload, comments, product help, party controls, saved lists, votes and responsive screens. An additional affected run after final tip/placeholder refinement is recorded in PRODUCT_HELP_CHAT_VERIFICATION.txt. Smoke passed; design detector returned [].

Desktop/mobile target renders: docs/screens/product-tools-desktop.png and product-tools-mobile.png. Cropped tool captures hide sticky navigation only while taking the screenshot so surrounding navigation does not cover the target; the application navigation is unchanged. Full-page party/mobile captures retain the normal navigation.

The first backend run exited with native process code -1073740791 before reporting tests. The rerun was sequential with two workers and passed. No app source workaround was added for the test runner. An initial new unit assertion expected optional controls to be absent from the DOM; corrected it to assert they are hidden in their closed disclosure.

## Limits

Existing chat history is preserved. Old tags cannot safely be classified as intentional or automatically applied, so only new sends change. Product help uses existing catalog data and cannot know missing merchant facts. Physical-phone keyboard/share-sheet and deployment/load tests were not run; backend remains one instance. No dependencies, data migration, new auth flow or end-party control was added.
