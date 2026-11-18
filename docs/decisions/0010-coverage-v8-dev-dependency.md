# ADR 0010: Add @vitest/coverage-v8 to Backend DevDependencies

## Context
Phase P5 requires measuring and verifying >= 80% line coverage on backend services, store, and routes using `vitest --coverage`. Vitest 5 requires `@vitest/coverage-v8` as its v8 coverage provider engine.

## Decision
Installed `@vitest/coverage-v8` as a development dependency (`devDependencies`) in `backend/package.json`. No runtime/production dependencies were modified.

## Consequences
- Enables automated v8 code coverage reporting in Vitest.
- Backend line coverage measured at 81.84% across services (82.22%), store (81.13%), routes (86.06%), and database (89.39%).
- Zero impact on production builds or bundle sizes.
