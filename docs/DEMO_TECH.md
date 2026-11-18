# Technical walkthrough
Spend 3 minutes on the existing React/Vite + Express/Socket.IO + SQLite boundaries, 3 on party state/events and transaction versions, 3 on session/participant permissions and name-only demo trust, 3 on tests and measured load, and 3 on production limits.

Review `partyStore`, `partySocket`, `shoppingHost`, the party migration, public result route, `useParty`, and the browser test. Demo a non-host rejection, Explore isolation, transfer, reconnect, and revoked public link. Use docs/party-latency.json and party-load-before.json/party-load.json for actual measurements.

1. Why keep Node instead of FastAPI? It preserves the existing Express/Socket.IO/SQLite implementation and avoids maintaining two room/voting backends.
2. Is a name authentication? No. The server-generated cookie/token owns the demo session; names are public display labels. No email identity or recovery is promised.
3. Can a guest take over another room? Party join validates that room's participant token and every action uses that bound room/participant; host actions additionally require the current host ID.
4. Why are reactions not a new table? They use the existing unique participant/product vote key, so replacement and group summaries have one source of truth.
5. What makes navigation reliable? Transactions, increasing versions, room-scoped channels and a full-state reconnect response. The five-client test asserts localhost fan-out below 300ms.
6. Does the host invent specs? No model is called. Comparisons/questions use actual fields and missing fields return unknown. Golden scenarios lock expected outputs.
7. Can this scale horizontally now? No. SQLite and local presence/timers/limits require one process. Postgres/shared storage and distributed coordination must be implemented and measured before multiple instances.
8. What happens to public data? Results expose first names, room title and product ranking only; names can be hidden and links revoked. They expire with the room. A public result is intentionally visible to anyone holding its random link.

Known gaps beyond this prototype: verified accounts/recovery, catalog rights/merchant feeds, suggestions outside the shortlist, video/voice, production deployment and multi-instance failover. Existing account APIs are compatibility paths; they are not required by the demo UI.
