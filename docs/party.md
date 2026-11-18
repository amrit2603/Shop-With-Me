# Feature 5.1 — Live Shopping Party

Don't just share products. Experience shopping together.

## Demo entry
Open the homepage, enter a display name, and choose Enter demo. There is no required email, password, signup or sign-in page. The server issues a private opaque httpOnly session to protect the creator's room actions. This identifies a browser session, not a verified person. The name is not a password. Friends can open an invite and enter only a display name. Existing cookie/participant credentials remain hashed at rest. Old /signin links redirect to the demo homepage; legacy account APIs remain for compatibility.

Choose Start Shopping Party, select at least two products, name the room, and create it. The checkbox selects live party versus a standard room. An existing standard room can also be upgraded with Start Shopping Party inside the room. Share the existing room link/code.

## State and ownership
One party belongs to one existing room. `party_state` persists mode, host participant, current product/gallery image, status and an increasing version. `party_events` stores explored products, reactions, suggestions, changes and catalog-host outputs. `party_suggestions` merges duplicate product suggestions. `party_results` stores the immutable end snapshot and public sharing settings.

The creator's private demo session starts the party. Thereafter, party controls belong to the host participant and can be transferred to a named guest without requiring an account. Each socket action rechecks the room-scoped participant token. SQL transactions serialize version changes. Late join/reconnect receives the current full small party state; clients ignore stale state versions. Explore navigation by a guest is logged but never broadcast. Bring everyone here clears independent views. Gallery thumbnails can be browsed locally by guests; host gallery changes are synchronized.

A disconnected host gets a 30-second grace period. If absent, control moves to the earliest-joined participant still connected. Returning hosts do not reclaim control. A new join also schedules the check, covering restarted servers or parties left empty. Timers and presence are single-process behavior; there is no multi-instance failover guarantee.

```mermaid
sequenceDiagram
 participant H as Host browser
 participant S as Node / Socket.IO
 participant D as SQLite
 participant G as Guest browsers
 H->>S: party:navigate + current participant identity
 S->>S: Validate token, expiry, membership, host/mode
 S->>D: Transaction: navigation event + state + version
 D-->>S: Current party state/version
 S-->>H: Acknowledgement
 S-->>G: party:state (small state; no room snapshot)
 G->>G: Ignore stale versions; show current product
```

## Event contract
Every action requires successful `party:join` with `{roomId, participantId, participantToken, lastVersion?}`. All payloads are Zod-validated and Socket.IO limits messages to 100 KB. Acks are `{ok:true,...}` or `{ok:false,code,error}`. Arbitrary room IDs in later action bodies do not change the bound room.

| Client event | Payload | Rule / result |
|---|---|---|
| party:join | roomId, participantId, participantToken, lastVersion? | Valid member; joins party-specific channel and restores full state and last host note |
| party:navigate | productId, imageIndex? | Host controls group; Explore guest gets only a local view |
| party:set-mode | mode: host or explore | Current host only |
| party:suggest | productId, note? | Any member; five/minute; duplicates merge; max 20 open |
| party:take-me-there | productId | Host; moves the group and closes matching suggestion |
| party:transfer | toParticipantId | Host; target must belong to this room |
| party:react | productId, vote | Any member; 10/10 seconds; replaces/toggles existing product vote |
| party:host | action: summary/compare/question/suggest; a?, b?, query? | Deterministic catalog host, rate limited |
| party:mute | muted | Host; controls proactive disagreement messages |
| party:end | empty object | Host; snapshots result, makes party read-only |

Server events: `party:started` on the normal room channel; `party:state`, `party:host`, `party:host-changed`, `party:ended`, `party:burst` on the separate party channel. Vote counts use the existing `vote:updated` event rather than an overlapping second voting feed. Bursts are transient, rate limited, capped at 20 on screen, and suppressed for reduced motion. Existing room presence/avatars, product comments, typing and attachment chat are reused. Party chat defaults to the current product tag. `@host`/`/host` questions and exact-name `/compare A vs B` commands publish a host response in the host panel.

## Host facts and result rules
No model or paid service is required. The catalog host is deterministic: product names, prices, categories, brands and descriptions come from stored catalog fields; missing specs stay unknown. Comparisons show data side by side. Suggestions rank existing shortlisted options; this prototype does not discover new merchant products. Group summaries and disagreements use actual votes. Outputs are audited in party_events. This is not a general-purpose chatbot or a merchant specification verifier.

Reactions map Love it -> Love, Looks great -> Like, Not for me -> No, Unsure -> Need more info. Scores: +3, +2, -1, 0. One active vote per participant/product; selecting it again removes it. Unreacted products cannot win. Equal highest scores are shown as tied; reaction count and stable ID only order display rows. No reactions means no winner. Participants count distinct room identities, not verified humans. Products explored count distinct accepted navigation/view events (including the initial product). Reactions received counts accepted reaction taps, including changes/removals; active votes determine rankings.

`/r/:shareId` is a server-rendered public page with OG/Twitter metadata and a random 24-character capability ID. It includes first names only, no chat, emails or credentials. The creator can hide names or revoke it. Revoked/expired pages return 404. Download image uses a local canvas; no external image service. Public pages use the same origin in production; Vite forwards /r/ to the backend in development.

## Limits
Twelve room identities per party. Products/suggestions stay inside the room's 2–8-product shortlist. SQLite, rate limits, host grace timers and socket presence are currently one-process. Run one backend instance with durable local DB/uploads. Multiple processes require shared presence/rate limits, timer coordination, a PostgreSQL repository, and shared object storage; a Redis adapter alone is insufficient. See measured load reports for actual capacity; do not infer production scale from a local browser demo.

## Compact UI entry points
The latest interface goes from name entry to one shortlist form and directly into the party. Standard-room mode/deadline are under Room options. Current leader controls are under Party controls, where One person leads maps to host mode and Everyone browses freely maps to explore mode. Compare & ask contains the single product-help panel. Product details, comments and chat tagging are disclosed when needed. The room code opens QR/invite details and Copy invite copies the URL.

## November 3 tab and room fixes

The React client uses an explicit X-Session-Token from sessionStorage; no tab restores identity from a shared cookie. Legacy API cookie sessions remain supported when that header is absent. New invites go to the landing's name entry and return to the intended room/product. Current room and creator/participant credentials are tab-scoped. BroadcastChannel detects inherited duplicate-tab sessions without sharing authentication tokens or revoking the original tab.

party:view publishes the member's room product/image; party:follow accepts a toParticipantId or null. Both reuse the party participant-token boundary. party:peers broadcasts room-scoped views/follow relationships; self/offline/cyclic targets are rejected and the final socket leaving clears followers. Explicit leave, disconnect and switching rooms retain host handoff scheduling. This remains transient single-process state.

Room sharing has WhatsApp and Copy link only; modal Close remains, and standard-room entry is outside the share card. QR generation/code-copy are removed. Personal saved entries use per-user/per-room sessionStorage keys and internal /room/:roomId/product/:productId links. They survive reload in the current tab, and clear on logout/closing it. Comments reuse persisted room/product threads, with author/time and Enter-to-post. Help me choose is now three tappable questions with one recommendation and up to two existing alternates; missing merchant/quality facts are never fabricated. Backend host/compare APIs remain compatible.
