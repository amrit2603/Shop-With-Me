# Decision 0006: Live Room Chat Architecture (Phase P2)

- Status: accepted
- Date: 2026-10-29

## Context
Feature 5 requires a real-time room-wide chat where all participants can communicate in real time while evaluating products and voting. This is separate from individual product comments.

## Architecture & Implementation
1. **Database Persistence**:
   - Table `room_messages` created in SQLite (`id`, `room_id`, `participant_id`, `participant_name`, `text`, `product_id`, `created_at`).
   - Indexed on `(room_id, created_at, id)` for efficient ordered retrieval.
   - Cascades automatically on room deletion.
2. **Real-time Synchronization (Socket.IO)**:
   - `chat:send`: Emitted by client with `{ text, productId? }`. Validates membership, non-empty text, 500-char max, profanity filter, and applies per-participant rate limit (5 messages per 10s). Returns acknowledgement callback `{ ok: true, message }` or `{ ok: false, error }`.
   - `chat:message`: Broadcast to `io.to(roomId)` upon successful message persistence.
   - `chat:typing`: Ephemeral broadcast to room peers (`socket.to(roomId)`), automatically throttled and debounced.
   - `presence:update`: Server-tracked active socket presence map (`roomId -> participantId -> Set(socketId)`). Broadcasts `{ online: [participantIds] }` on join, leave, and disconnect.
3. **REST History & Pagination**:
   - `GET /api/rooms/:roomId/messages?participantId=<id>&limit=50&before=<cursor>` provides cursor pagination (newest last).
   - Reconnecting or refreshing clients fetch history without duplicating existing messages.
4. **UI Components & Responsive Layout**:
   - `RoomChat` & `ChatPanel`: Clean message stream, plain-text escaping (XSS safe), optional product tag ("About: <product>"), online indicators, auto-scroll with "New messages" pill, typing indicator, send-on-enter, and reconnecting state banner.
   - Mobile responsive layout (375px): Seamless tab navigation (`Products | Chat | Summary`) with unread badge counter.
   - Desktop layout: Integrated side panel alongside products and decision summary.
