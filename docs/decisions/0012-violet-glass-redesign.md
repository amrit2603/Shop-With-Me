# ADR 0012: Violet backdrop, gold highlights, and shared presentation tokens

Date: November 3, 2026. Status: accepted by the user's redesign brief.

The supplied reference video replaces the older navy/lime brand commitment. Retain VYUMI, product truth, every existing route/control/label and authoritative backend behavior. Use a violet-grey starfield, rounded near-black stage, gold highlights, white primary pill actions, self-hosted Manrope and glass surfaces. CSS creates the decorative liquid orb; it has no product function or claimed statistics. The sample preview is explicitly decorative.

`frontend/src/theme.css` is the single presentation token source: semantic palette and scales plus centralized incumbent component values. `World.css` applies the new composition across the existing components. The public result renderer reads these same two files at startup rather than duplicating colors. Deployments must retain frontend source styles alongside the backend, as the existing source/Docker packaging already does. Canvas exports read computed CSS tokens. Avatar colors remain deterministic with CSS-token references.

Minimal markup additions create the decorative orb/sample preview and party presence strip. The strip reuses room socket presence; no second presence system. Existing comment/help details start open (user approved), retain their summaries and can still be collapsed. Their visibility tests migrate separately with the new contract. Host management and optional comparison selectors remain disclosures. All reaction, host, chat, saving and sharing behavior remains intact.

Motion is bounded to the orb/stars and existing reaction bursts; reduced-motion disables it. Blur is limited to navigation and the two landing overlays, with opaque fallback; operational panels use translucent fills without nested blur. No new runtime dependency.

This changes presentation, not AI capability or deployment architecture. The catalog remains single-image and the backend remains single-instance SQLite. Task 3 is not authorized by this ADR.
