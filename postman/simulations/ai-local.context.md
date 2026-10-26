# AI local simulation

Updated 2026-10-26 for Cloudflare's inference and toMarkdown REST response shapes. The handler is a deliberately small contract fixture, not a model quality test. No authenticated workspace is required for this local run.

## Purpose
Exercise Engram's real HTTP client, JSON repair, embeddings and worker with a local Cloudflare stand-in. See `postman/mocks/cloudflare/default.js`.

## Execution
Start `postman simulation run postman/simulations/ai-local.sim.yaml --port 4900 --no-history --output ndjson` from the repo root. Then run `node --test tests/aiSimulation.test.js` from `server/` with `RUN_AI_SIMULATION=1`. Tests use only an in-memory database and a placeholder API key.

## Assumptions
- The mock covers inference and PDF conversion with synthetic content. It cannot establish model availability, extraction accuracy, real quotas or Atlas search correctness. Historical Gemini observations below do not verify the current Cloudflare migration.

## Observations
<!-- begin:observations -->
- 2026-10-26 Ask regression: the real Express/AI HTTP path found a synthetic internship URL stored in a text note even with an empty Atlas keyword index. Original URL delivery, valid citations, uncited-answer source retention, no-match responses, owner isolation and Confidential exclusion passed. The Cloudflare simulation recorded inference and embedding requests. Suite result: 45 passed, 1 optional worker simulation skipped. This does not establish retrieval quality on personal data or live Atlas.
- 2026-10-26 automatic-privacy update: all 42 tests passed with both simulations enabled. Existing owner files queue without unlock, duplicate requests reuse a job, and exhausted scans can retry without manual classification. A simulated missing privacy field failed validation even after repair and left the file hidden; ordinary/private decisions still passed. The Cloudflare member received inference, extraction and embedding traffic; no members were silent. A separate headless-browser check passed delayed timeline loading and automatic-progress messaging. No new live provider-quality claim is made by this simulation.
- 2026-10-26 organization run: all 41 tests passed with both opt-in simulations enabled. The Cloudflare member served 19 inference, PDF and embedding requests in the final run, including JSON repair, extracted deadlines, confidential classification and 429/503 cases; no members were silent. Separately, five live synthetic text/image checks and Atlas owner/date/category/privacy filtering passed. Image processing now transcribes first and uses text enrichment for labels and events. These checks do not establish perfect detection on arbitrary personal documents or hosted configuration.
- 2026-10-26: Live text inference required chat messages to follow JSON instructions; parsed object replies are normalized to strings. Live image inference requires prompt plus image bytes instead. After the final adjustment, all 34 tests passed, with the Cloudflare member serving text, image, PDF, embedding and failure requests. No members were silent. Live JSON generation, embeddings and a synthetic one-pixel image request also passed; meaningful image/PDF extraction quality and hosted configuration remain unverified.
- 2026-10-26: Both Cloudflare simulation tests passed. Request events confirmed vision/text inference, JSON repair, PDF conversion, embeddings, 429/503 handling and an exhausted worker job becoming failed. This establishes synthetic HTTP integration, not live account access. The normal backend suite passed 32 tests with the two opt-in simulations skipped.
- 2026-10-25: Gemini received generateContent and embedContent traffic from the real client. JSON repair, 768-dimensional normalization, item enrichment and failed-job handling for HTTP 503 passed; HTTP 429 was also rejected. No members were silent. This proves local HTTP/error handling, not live model output quality.
<!-- end:observations -->

## What didn't work
- 2026-10-25: CLI 1.74 required an explicit `config.yaml` path rather than a mock directory; sandboxed startup also failed accessing Postman's local dataset files. An approved run outside the sandbox started successfully.
