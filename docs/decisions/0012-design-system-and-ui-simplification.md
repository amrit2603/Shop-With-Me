# ADR 0012: Design System and UI Radical Simplification

## Context
User feedback indicated the prototype was overly complex, visually noisy (neon glow/dark-mode clutter, long text blocks, nested builder cards), and lacked modularity (single component files exceeding 1,000 lines). Phase P6 mandates:
1. Default LIGHT theme with lots of whitespace, readable system typography, and one crisp accent color.
2. Standardized design tokens (spacing: 4, 8, 16, 24, 32px; 4 font size steps; clean neutral surfaces).
3. Radical simplification: Home page offers strictly two primary actions ("Start a room" and "Join with a code").
4. Modular component decomposition ensuring every file is under 250 lines.
5. Overall CSS codebase reduction of at least 40%.
6. Consistent 4 UI states (loading skeleton, empty, error with retry, success) across all views.

## Decision
1. Established comprehensive design tokens in `frontend/src/index.css` with a clean, light, accessible aesthetic.
2. Refactored `HomePage.jsx` and `RoomPage.jsx` into focused sub-components (<250 lines each).
3. Consolidated and eliminated redundant/dead CSS rules across component styles.
4. Added Playwright automated screenshot capture for visual regression testing at 375px and 1280px.

## Consequences
- Clean, fast-loading, accessible UI conforming to WCAG AA contrast.
- Modular code architecture that is straightforward to test and maintain.
- Significant reduction in bundle size and rendering complexity.
