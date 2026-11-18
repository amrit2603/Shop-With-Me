# Decision 0004: Preserve expired-link semantics after cleanup

- Status: accepted
- Date: 2026-10-29

The cleanup job must delete expired room contents, while old links must continue to return HTTP 410 rather than becoming indistinguishable from unknown IDs. Cleanup therefore records only the expired room ID and expiration time in a small tombstone table before cascading room deletion. Vote `created_at`/`updated_at`, comment `updated_at`, and room `expires_at` are migrated additively; legacy rows receive their best available timestamps.
