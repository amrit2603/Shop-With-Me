# ADR 0011: Add Playwright for End-to-End Testing

## Context
Phase P5 requires multi-context browser end-to-end testing with two concurrent browser contexts to verify the collaborative journey:
1. Creator creates room
2. Friend joins via shareable link with no account
3. Live voting, commenting, and room chat with real-time sync across both contexts
4. Creator final choice triggers live decision card display

Playwright is explicitly listed as an allowed addition in the assignment brief.

## Decision
Install `playwright` and `@playwright/test` in devDependencies of root `package.json` to run automated end-to-end tests across isolated browser contexts.

## Consequences
- High-fidelity validation of the complete user journey across two concurrent browser sessions.
- Non-intrusive devDependency that does not affect production artifacts.
