# 0013. Structured Logging with Pino

## Context
Phase P7 requires high-performance structured JSON logging with request IDs (`X-Request-Id`), sensitive token redaction, and log levels controlled via environment variables.

## Decision
Add `pino` to `backend/dependencies` for structured, low-overhead JSON logging with redaction for tokens, authorization headers, and cookies.

## Rationale
Pino is on the allowed dependency list, emits clean JSON lines for production log aggregators, and has zero dependencies with near-zero overhead.
