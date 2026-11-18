> Historical account-only checkpoint. The latest user brief replaces the mandatory login UI with name-only demo sessions, and Live Shopping Party is now implemented. See party.md, FEATURE_STATUS.md and LIVE_PARTY_REPORT.md for current scope.

# Account/login implementation status — November 2, 2026

Scope: L1 account foundation in the existing Shop With Me application. P1–P8 Live Shopping Party work has not been implemented.

Implemented: additive users/sessions/account room credentials migration; bcrypt cost 12; normalized email; strong-password/display-name validation; uniform login failures; IP and email login limits without a test bypass; opaque 7-day sliding httpOnly cookies with production Secure; SHA-256 hashes at rest; logout revocation; account-owned new rooms; legacy creator-token authorization; anonymous named guests; account autojoin; per-tab active guest storage and remembered names; sign-in/create-account screen; removal of stale saved header names; JSON/origin checks; source catalog tracked in Git and ZIP.

Latest gate: 190 backend tests, 33 frontend tests, lint, production build and auth-aware smoke pass. Both production dependency audits reported zero vulnerabilities. All 9 browser regression scenarios passed in 48.7 seconds, including account login and independent guest identity.

Remaining L1 verification: hardcoded-name frontend regression test (existing browser source scan already covers the previous hardcoded identity), account return-to-action persistence, comprehensive production origin/cookie deployment checks. Account rename policy and cross-origin split-host frontend cookies need additional work. Do not call this a production-ready authentication system.

Known limits: email verification, password reset and account recovery are not supplied. Auth rate limits are currently per-process; a distributed auth limiter is needed before multiple backend instances. Account room credentials are checked again on chat send/reaction so logout prevents further message writes; typing/presence and proactive socket disconnection on expiry still need a broader security review.

Run locally: npm run setup; npm run build; npm start. Open http://localhost:3001, create an account, create a room, then join the shared URL in another browser as a guest.
