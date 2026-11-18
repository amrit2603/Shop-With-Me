# Simple room release — November 4

Removed party creation checkbox/start flow and shared-navigation/follow/member-control UI. Room creation now offers Create room & get link. Independent product cards keep votes, private saves, sharing and product help. Removed product comments and image-download actions throughout product cards/saved views. Existing comment and party backend data/APIs are preserved, not deleted.

Files: HomePage and DemoEntry simplify entry copy/creation; RoomPage removes stage/party identity state and product-comment writes, keeps live chat/votes; RoomProductCard removes comment UI/counts and adds local product help; ProductActions removes image download and reuses compact Save/View/More; RoomProductHelp uses the existing catalog host through a new participant-authorized room help endpoint in routes/rooms.js. Card CSS keeps images compact and cards independently sized. No new dependencies.

Product help requires room membership/token, validates product/alternative/query, and does not start a party. Backend integration covers invalid credentials, other-product rejection and help with no party state. Legacy party backend tests stay active. Historical UI contracts for removed party/comments are retained in tests/retired-party; simple-room.spec.js replaces them for the new UX. Other browser contracts retain identity, invite sharing, private saves, attachments, live chat/votes, final choice and responsive checks.

First full browser pass found old deadline/tab-label assertions; migrated those in separate commits. Final command results recorded below. No physical-phone, new load or production deployment check. Historical comments/party data is not erased.

Verification: backend237/237, frontend47/47, browser13/13 (1.2m); lint/build passed; detector[]. Desktop/mobile renders inspected. VERDICT: PASS.
