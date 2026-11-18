# Delivery corrections and quick wins

Context: The supplied project already implemented most of Feature 5. The user's priority is a complete collaborative-shopping demo with a compact UI, private product saving, and sound backend behavior.

Decision: Retain React/Express/Socket.IO/SQLite and the current visual system. Repair broken URL preview, invented prices, screenshot submission, guest restoration, permission gaps, mobile overflow and default button styles. Add quick wins and private browser-local saving. Use the MIT qrcode-generator 2.0.4 dependency because the original hash-pattern helper was not a QR encoder. No other new runtime dependency was added.

Installation: Require Node >=22.12 and recommend Node 24. Install the backend with --ignore-scripts to use the packaged SQLite prebuild instead of npm's unnecessary Windows node-gyp step. Docker and CI target Node 24. Run the backend tests in Vitest's thread pool and name its ESM config .mjs.

Consequences: Saved items work without signup but remain on this browser. SQLite deployment is a single instance. Redis/PostgreSQL horizontal scaling, actual hosting/TLS, scanning, alerts and off-host backups are separate operational work. Test evidence and limits are maintained in RELEASE_NOTES.md.
