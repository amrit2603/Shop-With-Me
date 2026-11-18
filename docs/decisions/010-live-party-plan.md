# Live Shopping Party plan
Order: L1 account/session boundary and identity UI; P1 persistent/versioned party state and socket navigation; P2 shared reactions/chat; P3 deterministic shopping host; P4 result/share; P5 security; P6 measured load; P7 quality/ops; P8 demo/documentation.

L1 uses bcryptjs cost 12 (new dependency: password hashing without native build requirements), random opaque cookies with only SHA-256 hashes stored, 7-day sliding sessions, and session ownership for newly created rooms. Legacy rooms retain creator-token authorization. Guest credentials remain per tab.

No email provider: email verification and password reset are out of scope. SQLite remains a single-instance deployment until a PostgreSQL/shared-state implementation is verified. Existing tests must retain their assertions; authenticated fixture setup will be migrated explicitly as the creation contract changes.
