# ADR 0014: Scoped Per-Room & Per-Tab Participant Identity

## Context
Previously, `Navbar.jsx` hard-coded a static developer display name and fake user-account icons, creating confusion during demos and violating room tenancy. Furthermore, multi-user local demonstrations were blocked because multiple tabs of the same browser shared identical `localStorage` participant keys, preventing two browser tabs from playing two different people in the same room.

## Decision
1. **Remove Global Identity**: There is no global logged-in user. All identity is scoped strictly per room.
2. **Dual-Tier Tab Isolation**:
   - `sessionStorage` tracks the active participant for the specific browser tab (`active_participant_${roomId}`).
   - `localStorage` tracks the last known participant for that room on that browser (`last_participant_${roomId}`).
   - When a tab opens a room URL:
     - If `sessionStorage` has an active participant, it is immediately restored.
     - If `sessionStorage` is empty but `localStorage` remembers a participant, a join prompt offers "Continue as <name>" (one click) and "Join as someone else" (allowing a separate demo identity in that tab).
     - If neither exists, an inline display name input (2-24 characters, profanity filtered) is presented.
3. **Dynamic Top Bar & Participants Strip**:
   - Top bar displays the active participant's avatar with stable hash-derived color, display name, and a "Host" badge if the participant is the room creator.
   - An interactive menu on the chip allows changing the display name via `PATCH /api/rooms/:roomId/participants/:participantId`.
   - Alongside, a participants strip displays avatars of everyone in the room (max 5 visible, plus a `+N` badge) with real-time green online presence dots and "(You)" indicator on the local user's avatar.
4. **Server Authoritative Authorship**:
   - Comments and chat messages derive participant display names strictly from the database participant record, never trusting client-supplied strings.
5. **Home Page Identity**:
   - Only displays a read-only name chip if a display name was previously saved; otherwise renders clean without fake sign-out or profile buttons.

## Verification
- Vitest backend tests: 162/162 passed.
- Vitest frontend tests: 33/33 passed.
- Playwright E2E: `tests/e2e/identity.spec.js` verified two browser contexts + extra tab in the same context simultaneously acting as three distinct users with real-time strip updates and renames.
- Zero occurrences of hardcoded developer names in the entire codebase.
