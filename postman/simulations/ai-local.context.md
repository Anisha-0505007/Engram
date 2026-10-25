# AI local simulation

Created 2026-10-25 from Google's documented generateContent/embedContent response shapes; the handler is a deliberately small contract fixture, not a model quality test. Owner workspace search was skipped; no authenticated workspace is required for this local run.

## Purpose
Exercise Engram's real HTTP client, JSON repair, embeddings and worker with a local Gemini stand-in. See `postman/mocks/gemini/default.js`.

## Execution
Start `postman simulation run postman/simulations/ai-local.sim.yaml --port 4900 --no-history --output ndjson` from the repo root. Then run `node --test tests/aiSimulation.test.js` from `server/` with `RUN_AI_SIMULATION=1`. Tests use only an in-memory database and a placeholder API key.

## Assumptions
- The mock covers only the two documented HTTP actions and synthetic test content. It cannot establish model availability, extraction accuracy, real quotas or Atlas search correctness.

## Observations
<!-- begin:observations -->
- 2026-10-25: Gemini received generateContent and embedContent traffic from the real client. JSON repair, 768-dimensional normalization, item enrichment and failed-job handling for HTTP 503 passed; HTTP 429 was also rejected. No members were silent. This proves local HTTP/error handling, not live model output quality.
<!-- end:observations -->

## What didn't work
- 2026-10-25: CLI 1.74 required an explicit `config.yaml` path rather than a mock directory; sandboxed startup also failed accessing Postman's local dataset files. An approved run outside the sandbox started successfully.
