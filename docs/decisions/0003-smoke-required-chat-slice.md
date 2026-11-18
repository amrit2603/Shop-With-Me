# Decision 0003: Implement the smoke-required chat foundation in P0

- Status: accepted
- Date: 2026-10-29

P0's prescribed smoke scenario includes chat, but the supplied app did not implement room chat. Added the minimum real storage, member check, history endpoint, and socket delivery needed for a meaningful G6 pass. This uses the pre-existing participant-ID identity contract temporarily; token-based authentication and full chat requirements remain P2/P3 acceptance criteria. Existing frontend tests described vote/comment interactions missing from the supplied markup, so those behaviors were restored without changing tests.
