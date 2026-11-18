# Simpler Live Shopping Party

The default party view now shows one product image, its name and price, four reaction buttons, a short product tray, and one conversation area. The existing dark VYUMI palette and lime accent remain.

## What moved

- Human controls are grouped under **Manage party**: shared browsing, passing control, automatic tips and ending the party. The default still follows one person; nobody needs to choose a mode to begin.
- The person's badge says **Leading**, while the single product assistant is reached through **Help me choose**. Its replies say **Shopping assistant**, avoiding two different meanings of “host.”
- Details and product comments share one disclosure. Comparison selectors stay behind **Choose products to compare**; the default pair can be compared immediately.
- Product thumbnails no longer repeat long product names. Their accessible names and tooltips still identify each product.
- Party chat uses **Chat / Votes**, retains attachments and product tagging, and drops the redundant visible chat heading/minimize control. Standard-room chat keeps its original controls. A regression test covers upgrading an already-minimized room.
- The live-party deadline is shown as a short duration instead of a changing seconds counter. Invite/code/QR access, private saved finds, all modes, suggestions, reactions, comments, transfer, comparison, summaries and result sharing remain available.
- Added the missing shared `.sr-only` utility so intended screen-reader labels and reaction announcements do not appear as duplicate visible copy.

No backend endpoint, permission, state machine, persistence or dependency was changed in this pass.

## Reference evidence and access limits

- [Rikover & Co., Video chat e-commerce](https://dribbble.com/shots/23895525-Video-chat-e-commerce): retrieved the page with Firecrawl and visually inspected its main design image. It groups a shared experience, product tray and secondary tools. The VYUMI adaptation uses that separation; it does not copy the brand, claim video calling, or add a fake video panel.
- [Verishop Shop Party announcement](https://www.businesswire.com/news/home/20201215005864/en/Verishop-Launches-Shop-Party-Feature-for-Online-Video-Shopping-with-Friends): the Firecrawl search excerpt describes browsing and conversation together. Direct scraping failed, so no claim is made about unseen visual details.
- Mobbin refused the screen search because the connection requires a paid plan. No Mobbin screen was inspected or used as evidence, and the refusal was not retried.
- The supplied LinkedIn article could not be scraped. CollabVerse search returned weak/unusable matches, so it was not treated as a verified visual reference. The opaque image links were not substituted with invented designs.

## Verification

Frontend tests: 34 passed. The four-context party browser journey verifies synchronized navigation, counts, comparison, host transfer, Explore/suggestion/group pull, end/result/public link and revocation. It also asserts advanced controls are hidden by default and all four reactions fit above the mobile tab bar. The full 10-scenario browser suite, lint/build and smoke results are recorded in PROGRESS.md. The final UI detector returned no findings.

[Before](screens/party-simple-before.png) · [After](screens/compact-party-default.png) · [Mobile](screens/compact-party-mobile-default.png)

No new deployment, internet latency measurement or load benchmark was run for this UI-only change. Existing single-instance SQLite and deterministic catalog-assistant limits remain.
