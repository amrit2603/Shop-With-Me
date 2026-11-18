# Tab and room fixes — November 3

Scope: the eight requested fixes only. Preserve the current visual identity, room product-add endpoints, vote arithmetic and socket permissions. Replace browser-wide identity restoration with explicit per-tab sessions; update every authenticated frontend fetch and creator credential caller. Personal saves use sessionStorage keys scoped by user and room; existing unscoped localStorage items are not assigned to an arbitrary user.

Policy: {"planning":"deep","context_depth":"dependency","verification_depth":"impact","delegation":"none","reason_codes":["tab-authentication-boundary","live-follow-state","shared-product-routes"]}.

Changes must reach: account session middleware/demo response, API/auth/party fetch callers, Home/Room storage and entry routes, share-card callers, saved-product utility/actions/view, product detail routes/comments, party socket/hook/controls, catalog assistant and full vote cards, affected tests and evidence. Keep cookie API compatibility for legacy clients; an explicit tab-session header must never fall back to another tab's cookie. New named sessions must not revoke another tab's session.

Follow state is transient and room-scoped on the existing server, validated with existing participant credentials. Reject self-follow, cycles and offline/nonmember targets; clear follows when a participant leaves. It is not durable/distributed presence. Product comments reuse existing persisted per-room/product comments and events. Source/spec/adder fields must report unknown rather than fabricate facts.

User-requested contract changes override old QR-preservation and compact-assistant rules: remove share-card QR/code-copy logic, simplify help to three questions, and migrate affected browser assertions explicitly. Verification will include same-browser tabs (shared cookies), reload, private saves/deep links, comments, follow/leave, recommendation reset, share contents, product cards, responsive screenshots and console errors, plus existing regression suites.
