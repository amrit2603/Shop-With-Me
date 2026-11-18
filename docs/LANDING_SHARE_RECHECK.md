# Landing and sharing restoration — November 3, 2026

The latest user request supersedes the previous full-viewport landing and display-only-code requirements. “Seattle option” was clarified by the user as the **Share button**.

## Changes

- Restored the previous violet backdrop, rounded outer stage, desktop/mobile margins and centered landing composition. Removed only the later full-viewport overrides; existing content, name entry, orb and sample/invitation cards remain.
- Restored **Share** in the invitation card. It sends the actual invitation URL, title and short message to the browser's native share API. Where that API is unavailable or fails, it copies the invitation link. Cancelling native sharing is reported honestly.
- Made the large room code a labelled, keyboard-accessible copy button again. The room-header code chip also copies the code while opening sharing options. Code-copy and link-copy confirmations are distinct.
- The previous code was a noninteractive text element, so clicking it left previous clipboard content unchanged. The regression test explicitly seeds the clipboard with `impeccable`, clicks the code and reads back the actual six-character code. No application runtime message or clipboard payload contains Impeccable tooling text.
- Reviewed the other copy callers and replaced unchecked fallbacks with the existing checked `copyText` utility. Header, reusable CopyLinkButton and result copying no longer claim successful copying when it failed.
- Found a stale-version startup issue: the Windows launcher opened whichever copy already answered on port 3001. It now stops with an explicit instruction to close the older terminal and relaunch; it does not kill unrelated processes or open the old version.

## Files

| File | Change |
|---|---|
| frontend/src/World.css | Removed six full-viewport landing override lines, restoring the preceding layout |
| frontend/src/pages/HomePage.jsx | Removed the obsolete landing-full marker |
| frontend/src/components/home/RoomReadyCard.jsx | Share button, direct invitation payload/fallback, actual code button and distinct feedback |
| frontend/src/components/room/RoomHeader.jsx | Click code to copy/open sharing; shared checked clipboard helper; accurate failure message and title |
| frontend/src/components/CopyLinkButton.jsx | Shared checked helper instead of unconditional fallback success |
| frontend/src/components/party/PartyResult.jsx | Reuses the same reliable copy helper |
| frontend/tests/roomSharing.test.jsx | Code/link separation, native share payload, unsupported fallback, cancellation and failed copy |
| tests/e2e/tab-room-fixes.spec.js | Updated landing/share contract; actual clipboard readback replacing old text; direct URL share/fallback checks; existing feature assertions retained |
| tests/e2e/room-name-and-code.spec.js | Migrated the explicitly superseded two-action/display-only-code expectations |
| Start-Vyumi.cmd | Does not silently reuse an older running copy |
| RUN-ME-FIRST.txt | Current sharing and stale-version startup instructions |
| AGENTS.md, DESIGN.md | Latest landing/sharing contracts for future work |
| docs/FEATURE_STATUS.md, docs/TAB_ROOM_FIXES_REPORT.md | Mark prior landing/share rows as superseded by this request |
| docs/PROGRESS.md | Actual checkpoint evidence |
| docs/screens/ | Refreshed browser regression screenshots; current landing/share captures inspected |
| docs/party-latency.json | Refreshed by the existing backend regression, not a new load benchmark |

Scope policy: compact planning, dependency-level context, impact-based verification, no delegation. The implementation reuses the existing design, clipboard utility and room/session infrastructure. No package or backend behavior change was needed.

## Verification

Fresh results: 233 backend tests, 42 frontend tests and all 14 browser scenarios passed (1.5m); lint/build/smoke passed. Both production audits report zero known vulnerabilities. Command evidence is in LANDING_SHARE_VERIFICATION.txt. Checks cover frontend/backend tests, lint/build, smoke, the complete browser suite, both production dependency audits and a checked occupied-port launcher run. The browser suite continues to cover independent tabs, follow/transfer, private saves, comments, recommendations, complete cards and public results. Existing assertions were migrated only where the latest request deliberately changes the landing/sharing contract.

The occupied-port check ran against the owned test server and confirmed exit code 1 with the stop-old-copy message, without building or opening the old copy. Production dependency audits reported zero known vulnerabilities in backend and frontend. Mechanical UI scan returned no findings.

This is a recheck of the runnable project and the connected code paths, not a guarantee that every possible environment or interaction is bug-free. The real operating-system share sheet was not exercised on physical hardware; its URL payload, cancellation and fallback were verified with controlled browser/unit checks. Localhost invitation URLs only work on the same computer; other devices require a reachable address/hosting and the configured origin. Existing single-instance backend and tab-private saved-item limits remain.

## Current visual evidence

[Restored desktop landing](screens/tab-fixes-landing-1280.png), [restored mobile landing](screens/tab-fixes-landing-375.png), [Share and clickable-code card](screens/tab-fixes-share-card.png). All three final captures were inspected.
