# ADR 0015: Mandatory Room Name Validation & Unambiguous Room Code

## Context
Rooms previously could be created without a name or with blank spaces, leading to a blank "ROOM" heading in the workspace. In addition, room codes were tied to hexadecimal prefixes which contained visually ambiguous characters (0 vs O, 1 vs I vs L, 5 vs S, 8 vs B), making manual copying or verbal sharing error-prone.

## Decision
1. **Mandatory Room Name Validation**:
   - Backend `POST /api/rooms` and `PATCH /api/rooms/:roomId` strictly validate room title.
   - Criteria: string, trimmed length between 3 and 60 characters inclusive, not only punctuation or emoji symbols (must contain at least one unicode letter or number to support global scripts such as Devanagari Hindi or Kannada), collapsed repeated spaces, passes profanity filter, and is not the literal word "room".
   - If invalid: rejects with 400 and friendly message `"Give your room a name so friends know what you're deciding"`.
   - Migration fallback: existing rooms with empty or null titles safely display `"Untitled room"`.
2. **Unambiguous 6-Character Room Code**:
   - Stored in `rooms.code` column with unique index.
   - Generated from a 27-character unambiguous alphabet (`234679ACDEFGHJKMNPQRTUVWXYZ`), explicitly excluding `0, O, 1, I, L, 5, S, 8, B`.
   - Joining accepts uppercase, lowercase, spaces, and hyphens (e.g. `"d79 pcv"` and `"d79-pcv"` resolve to `"D79PCV"` and match the room).
3. **Interactive "Room Ready" Card**:
   - Displays the room code in large monospaced letters; clicking or tapping the code copies it.
   - Separate "Copy link" and "Copy code" buttons with visible confirmation toast and accessible `aria-live` announcement.
   - Clipboard fallback using `document.execCommand('copy')` for non-secure contexts (http/localhost).
   - Local, zero-dependency SVG QR code generator with no external network requests.
   - Web Share API (`navigator.share`) integration with graceful fallback.
   - Accessible directly from the room header.

## Verification
- Vitest backend tests: 164/164 passed (+2 dedicated tests for R2 title rules and unambiguous room code joining).
- Vitest frontend tests: 33/33 passed.
- Oxlint: 0 errors.
- Production dependency audit: 0 vulnerabilities across backend and frontend.
- Playwright E2E: `tests/e2e/room-name-and-code.spec.js` verified creation button disabled when name is invalid, quick-pick starter chips, large monospaced code copy, QR code toggle, and room header modal integration.
