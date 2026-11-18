# 16. R3 - Group Chat UI & Hardened Attachments Architecture

Date: 2026-10-29
Status: Accepted

## Context
Feature 5 calls for persistent real-time room chat with support for attachments (group chat with images and PDFs). The prompt specified:
1. Checking for `REACTBITS_LICENSE_KEY` in environment. If missing, follow Step 6 fallback: build the Chat 5 layout in plain React + CSS matching the block structure (grouped bubbles, sender names and avatars, timestamps, attachment cards, rich composer with attach, drag-and-drop, clipboard paste, lightbox modal).
2. Server-side attachment hardening:
   - Accept only JPEG, PNG, WebP images, and PDF. Strictly reject SVG, HTML, scripts, and executables.
   - Enforce 3 MB per file cap and 20 MB total room quota.
   - Verify magic bytes directly from buffer; ignore client-provided Content-Type or file extensions.
   - Store files on disk under `/uploads/rooms/<roomId>/` using cryptographically random hex filenames with verified extensions.
   - Record metadata in SQLite `attachments` table.
   - Serve attachments strictly through an authenticated route (`GET /api/rooms/:roomId/attachments/:attachmentId`) verifying room membership.
   - Set security headers: `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` for images and `attachment` for PDFs.
   - Cascade delete attachments with the room cleanup job.

## Decisions

### 1. React Bits Chat 5 Implementation Path
Environment check confirmed `$env:REACTBITS_LICENSE_KEY` was missing. As specified by the technical brief fallback path, we implemented the Chat 5 architecture using modular React components (`ChatPanel.jsx`, `ChatMessageGroup.jsx`, `ChatLightbox.jsx`) and scoped CSS (`ChatPanel.css`):
- **Message Grouping**: Consecutive messages from the same participant within 5 minutes are grouped into single sender blocks.
- **Visual Design**: Matches VYUMI's deep navy/neon lime palette (`--accent: #ccff00`) with stable hash-derived avatar colors, readable typography, and contrast-checked text.
- **Lightbox Preview**: Fullscreen modal with blur backdrop, keyboard `Escape` dismissal, image dimension constraints, and direct download option.

### 2. Multi-Tier Attachment Security
- **Magic Bytes Validation**: `attachmentService.js` examines the first 16 bytes of buffer data (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `RIFF...WEBP` for WebP, `%PDF-` for PDF). Disguised files (e.g. HTML/JS with `.jpg` extensions) are rejected with a 400 status.
- **Path Traversal Defense**: Client filenames are sanitized (`path.basename` with `[^a-zA-Z0-9._-]` replacement). Server files are written strictly to resolved random hex names (`<random16Hex>.<ext>`) within the room directory. Path containment is asserted before any file access.
- **Cross-Room & Non-Member Isolation**: Attachment queries require matching `room_id` and verified participant tokens. Access across rooms or by unjoined participants returns 404 or 403.
- **Lifecycle & Quota**: Room storage is tracked via SQLite aggregate sum, rejecting uploads exceeding 20 MB. Expired rooms immediately reject uploads with 410. Expired room cleanup triggers physical removal of the room's attachment folder on disk.

## Consequences
- Full compliance with Feature 5 real-time chat and attachment specifications.
- Complete test coverage across unit tests (`attachments.test.js`), end-to-end multi-client Playwright tests (`chat-attachments.spec.js`), and delivery smoke verification (`smoke.js`).
