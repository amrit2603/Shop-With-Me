# Compact UI revision

The user's request is to simplify the existing shopping experience while retaining Feature 5 and 5.1. Preserve the existing dark navy/lime identity and existing Node/Socket.IO/SQLite backend. This is interface simplification, not a backend rewrite or an addition of more assistant modes.

## Default path
Enter name -> name the decision and choose products -> Start Shopping Party -> invite friends from the room. Starting a party no longer asks the user to choose Host/Explore or enter an intermediate room-ready screen. A standard shopping room remains available under Room options.

## What changed
- One creation surface replaces the separate hero and builder; three products appear initially and Browse all keeps the full catalog reachable.
- Source selection is a compact row. Suggested room names and expiry/room type use disclosures.
- Product, four reactions and conversation remain visible on the party screen.
- Leading/browsing/transfer/end actions are grouped under Party controls; defaults already follow the leader.
- Product details/comments and optional chat tags open only when needed.
- Compare & ask is the one product-help entry. Group summary, comparisons, questions, suggestions and mute/resume remain accessible there; shared answers reveal themselves in context.
- Invitation code opens invite/QR details; Copy invite is the single persistent header action. Duplicate invite actions are removed.
- Saved products, screenshot/URL import, product gallery, reactions, comments, attachments, private wishlist, host transfer, Explore suggestions, public result/revocation and image export are preserved.
- Removed the unused HomeHero component/styles and moved shared control styles out of that dependency.

## References and access limits
Mobbin's tools were absent from this session; no Mobbin findings are claimed. Firecrawl retrieved all four supplied reference images as image/text content and the original Rikover case study. The interaction cues used are a clear shared product stage, conversation alongside shopping, a compact product tray and direct voting. Original reference assets were not copied into the app.

Original Rikover case study: https://dribbble.com/shots/23895525-Video-chat-e-commerce

The Verishop launch was found in search excerpts, but the full Business Wire scrape failed. The supplied LinkedIn article also failed retrieval. The CollabVerse caption was not independently verified as an Appwrite showcase; only the supplied image's product/chat/recommendation content was used. These limits are not treated as missing implementation requirements.

Supplied image references:
- [Verishop Launches 'Shop Party' Feature for Online Video Shopping with Friends](https://images.openai.com/static-rsc-4/iS4Qn3bJSqIk430yM5yrSNQnybjWZZzEisOkc835dhrTXbJgJTdabmrQ4IVQVdRHfyRNjYuwq8H6FNtabxsRXQj9RZ-Ga-2mKAfYK1Nh5KgzrYYQKhTZArkW8fB00pXzWv0Zn_D3VsqHevs71Gj2m-YZvD5RvgDD83P2vv-RMWc?purpose=inline)
- [Video chat e-commerce by Rikover & Co. on Dribbble](https://images.openai.com/static-rsc-4/dzB8g8Rt_EqsyTqcG2t9bIDiqwhb8hfeTQNdCxhK4f3GSoBji4mnABFqu_-YAQ2yU5hepb9v2-vjW_J5VP1CBxWsWs_e2PYQa98Az_ZOKxAPFXBydpM-z1rpfbjgRkpJaiXMWxkdHQs9Q7Hhdhjn-bCcMAmfvaaZARujSZgAY0g?purpose=inline)
- [CollabVerse | Built with Appwrite](https://images.openai.com/static-rsc-4/yBLcofKNfntpfAThpE3TllNwHteawB7e0em2SFvYUMaE48iR1GWaIkht2NiA5Mi6dz4DYgC_xlKMoJLJj7z4K57JStMfTzVF9IR-eXRdDhpjXEPA3u9I1Wp4hln1yiq_xjdZ0B0GLbaiCB_DxzmxgWlKrWFgAL93EQC08jDgBL0?purpose=inline)
- [Amazon’s New 'Consult-a-Friend' Feature: Transforming Online Shopping into a real Social Experience](https://images.openai.com/static-rsc-4/kjnTBS4AQNSgG0c_ATrMeCXiszzW1r-cmHPUMvwXW0UqhOZf7TnOpXquNN0co09FehVMx9qJI1zyExbZ3fbgDi1xvSF5GdDOpyLmjRsL_c4Bp3phlKqo29vSgbsZ7tVd6J9LF-JTDATrXxUorOa1vAiHvyv89hKAWL_nmO4u60k?purpose=inline)

## Verification
Backend remains unchanged in this UI revision. Full backend suite passed 230 tests; frontend passed 33 tests, lint and build. The final full browser run passed all 10 scenarios, including native disclosures, invite/QR controls, four-context party actions, and all four mobile reactions above the fixed tabs. Frontend 33 tests, lint/build and smoke also passed. The final detector result is recorded in PROGRESS.md. Existing navigation fixtures are migrated explicitly to the new one-screen creation path and native disclosures; original feature assertions remain. A new assertion checks default party controls/comments/help are hidden, and a mobile assertion checks a primary reaction remains in view at 375px.

Screenshots: party-before-simplification.png is the prior expanded interaction state; compact-party-default.png and compact-party-mobile-default.png show the new default. The content/interaction states are not identical, so these are interface examples rather than a pixel-diff claim.

Known limits are unchanged: one SQLite backend, deterministic catalog help, no actual voice/video, and no production deployment claim. Large backend load benchmarks were not rerun for an interface-only change.
