# Live Shopping Party and demo identity
The latest user request replaces the mandatory account entry with a name-only demo identity. Reuse opaque server sessions and creator ownership; no shared demo password or global permission bypass. Keep Node/Express/Socket.IO/SQLite; do not migrate the existing backend to FastAPI for this extension.

Party state is persisted and versioned in SQLite; socket events carry participant credentials, are validated, and broadcast only to a party-specific room. Reactions reuse the votes table. Shopping-host facts and comparisons are computed from catalog data without requiring an LLM. Result statistics come from persisted party events and votes. The prototype remains one SQLite process; Redis fan-out alone does not enable database scaling.
