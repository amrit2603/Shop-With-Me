# Decision 0005: Keep AI local, optional, and outside decision arithmetic

- Status: accepted
- Date: 2026-10-29

The AI gateway is dependency-free and disabled unless `OLLAMA_URL` is configured. It receives only code-computed vote counts, option positions, participant count, and comment text; it never receives product IDs, SKUs, prices, URLs, or product names. The code validates the paragraph/reasons schema and silently retains the deterministic summary when Ollama is unavailable, times out, or returns invalid data.
