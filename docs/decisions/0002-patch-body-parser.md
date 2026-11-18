# Decision 0002: Patch the backend body-parser advisory

- Status: accepted
- Date: 2026-10-29

`npm audit --omit=dev --prefix backend` reported a high severity body-parser denial-of-service advisory. Ran `npm audit fix --omit=dev` to update the locked Express transitive dependency to body-parser 2.4.0; no new direct dependency was introduced. Because npm pruned development packages under `--omit=dev`, restore the complete locked development environment before running test gates.
