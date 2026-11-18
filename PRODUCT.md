# VYUMI — Shop With Me

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The priority audience for this prototype is the non-technical professor and the VYUMI company/technical reviewers. The prototype must make the shopping workflow easy to demonstrate and allow the technical team to inspect its implementation and limits. This priority was confirmed by the user during initialization.

The product roles being demonstrated are a shopper hosting a purchase decision and friends helping that shopper choose. The latest user brief replaces required signup/login: hosts enter only a display name to receive a private demo session; invited friends also join using a display name. Email and password forms are not part of the demo entry.

## Product Purpose

Help a shopper collect a product shortlist in one room, invite multiple friends, receive their opinions, and make a decision together. Friends can privately save products for their own later shopping without changing the host's shortlist.

The planned Live Shopping Party extension adds the experience of viewing products together: a host changes the shared product, friends see the change, discuss and react, and the group receives a shareable result. This is an extension of the same rooms, votes and chat, not a separate application.

Success for this prototype means reviewers understand and can demonstrate the actual user journey, backed by runnable code and honest verification evidence.

## Operating Context

Professor-facing demonstrations need plain language and a clear journey. Company/technical review needs visible permission boundaries, persistent behavior, real test results, and an honest scaling explanation.

The current project runs locally on Windows with Node.js and a browser. The frontend uses React and Vite; the backend uses Node.js, Express, Socket.IO and SQLite. Preserve this existing stack. A localhost room link only reaches the same computer; multi-device demos need a configured reachable address and origin. Public hosting has not been established by initialization.

## Capabilities and Constraints

Implemented at the latest checkpoint: account registration/sign-in/sign-out and sessions; authenticated creation of named shopping rooms; 2–8 product shortlists; a unique code/shareable room URL; guests with display names; room-scoped votes, comments and live chat; private tab-local saved products; and a downloadable decision card. Guest active identities are scoped per browser tab. Missing product prices stay unknown.

The Live Shopping Party prototype now adds shared product navigation, Host/Explore modes, suggestions, live reactions mapped to the existing votes, host transfer and disconnect handoff, a deterministic catalog host for comparisons/questions/summaries, and revocable public result pages. This is a prototype with single-instance SQLite constraints, not a claim of production readiness. See docs/party.md, docs/party-load.json, and the latest feature status for exact verification and limits.

The backend is authoritative for identity, authorization, validation, counts, limits and rankings. Optional language-model output may only phrase validated structured facts; core behavior must work without a model. Do not invent prices, specifications, merchant URLs, SKUs or benchmark results. Do not use merchant APIs or scrape behind authentication.

SQLite currently implies a single application instance with durable local storage. Multi-instance scalability requires further implementation and measurement. Email verification, password reset and account recovery are not provided. Personal saved products are scoped by user and room in the current tab; logout/closing the tab clears them. Export remains available. Sessions and room credentials are tab-scoped; new tabs require name entry.

## Brand Commitments

Preserve the VYUMI name and Shop With Me terminology. Live Shopping Party is the name of the planned Feature 5.1 extension. The November 3 redesign brief replaces the previous dark navy/lime commitment with a violet-grey backdrop, near-black rounded stage, warm gold highlights, white primary pill actions, Manrope typography and restrained glass surfaces. The supplied liquid-metal video is the visual reference. Preserve plain copy, clear actions and existing functionality.

Use short, plain interface copy and one clear primary action per screen. Keep developer implementation details out of shopper-facing flows unless they help the person make a meaningful decision.

## Evidence on Hand

The existing frontend and backend source, README.md, docs/PROGRESS.md, docs/FEATURE_STATUS.md, docs/LOGIN_STATUS.md, docs/LIVE_PARTY_REPORT.md, test suites, and docs/screens/ provide implementation and demonstration evidence. The account checkpoint records 190 backend, 33 frontend and 9 browser tests passing; those historical results do not prove unimplemented party behavior.

Existing catalog products and product images are demo material, not proof of merchant inventory, verified current prices or company commercial rights. The requested party demo seed should use synthetic products and owned/placeholder images. Do not fabricate testimonials, customers, performance figures or production-readiness claims.

## Product Principles

- Make the demonstrated workflow understandable to non-technical reviewers and inspectable by technical reviewers.
- Keep guest participation quick and independent from account-based hosting.
- Make each person's identity, room permissions and private saved products unambiguous.
- Preserve one authoritative source for product facts, reactions and group decisions.
- Distinguish implemented behavior, planned behavior and measured evidence in every delivery claim.

## Accessibility & Inclusion

The requested quality target is WCAG AA contrast, keyboard operation, meaningful labels and live announcements, and respect for reduced-motion preferences. The prototype must support mobile web at 375 px and desktop at 1280 px. These are requirements, not a claim of a completed accessibility certification.

## Open Decisions

Deployment target, production domain, operational ownership and the company's approval for third-party catalog assets remain unconfirmed. No additional demographic targeting, pricing model or commercial positioning is established by this initialization.
