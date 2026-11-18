# Decision 0003: Spec Compliance Gaps (Phase P1)

- Status: accepted
- Date: 2026-10-29

## Context
Phase P1 addresses core compliance gaps against the VYUMI Feature 5 specification:
1. Room expiration and lifecycle (configurable `ROOM_TTL_HOURS`, 410 Gone status for expired rooms, expired room tombstones).
2. Vote and comment auditing timestamps (`created_at`, `updated_at`).
3. Local profanity filtering for display names, comments, and room messages (normalization, zero external dependencies, robust false-positive handling).
4. Optional Ollama AI summary gateway (`generateJson`, JSON schema validation, timeout, strict structured-counts-only input, deterministic fallback).
5. Catalog model extension (SKU, brand, currency, images, bullets) and local fallback assets.
6. Documentation fixes (test count 114 backend / 22 frontend, 24 catalog products).

## Decisions
- Expiration: Added `expires_at` column to `rooms` with migration, tombstone tracking in `expired_rooms`, and `cleanupExpiredRooms()` routine.
- Timestamps: Added `created_at` and `updated_at` to `votes` and `comments` with backward-compatible migrations.
- Profanity: Created `backend/src/services/profanityFilter.js` handling leetspeak, punctuation obfuscation, repeated characters, masking, and whitelisting common false positives.
- LLM Gateway: Isolated optional AI generation to `llmGateway.js` with 5s timeout and schema validation. Code arithmetic is strictly preserved.
- Catalog: Backfilled shared VYUMI product fields on all 24 items in `backend/src/data/products.js`.
