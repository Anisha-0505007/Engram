# API contract

JSON requests, same-origin browser session, JWT in `token` httpOnly cookie. User identity is never accepted in a request body. Errors use `{ "error": "safe message" }`. Auth/search/webhook limits may return 429; fixed-window limits include `Retry-After`. Invalid input returns 400, unauthenticated requests 401, missing/foreign items 404 and unavailable dependencies 503.

| Method/path | Input | Success |
|---|---|---|
| POST `/api/auth/register` | `{email, password}`; email normalized, password ≥8 characters and ≤72 bytes | 201, session cookie |
| POST `/api/auth/login` | Same credentials | 200, session cookie |
| POST `/api/auth/logout` | None | 200, cookie cleared |
| GET `/api/auth/me` | Session | `{userId,email,whatsappPhone?}` |
| POST `/api/auth/link-code` | Session | `{code}`; consume within 10 minutes |
| GET `/api/items` | Optional type/status/category/dateFrom/dateTo/cursor/limit (1–50) | `{items,nextCursor}` |
| POST `/api/items` | `{text}`; 1–20,000 trimmed characters | 201, pending item |
| POST `/api/items/upload` | `{data,mime,caption?}`; base64, JPEG/PNG/WebP/PDF, max 10 MB decoded, magic bytes checked | 201, pending item |
| GET `/api/items/search` | `q` ≤500 chars, optional type/dateFrom/dateTo/category/mode | `{items,parsedQuery,warnings}` |
| POST `/api/items/ask` | `{q,type?,dateFrom?,dateTo?,category?}` | `{answer,sources,items,warnings}` |
| GET `/api/items/:id/media` | Session and owned item | `{url}`; short-lived signed URL |
| PATCH `/api/items/:id` | `{category,tags}`; category ≤80 chars, ≤20 tags of ≤40 chars | Updated item; empty overrides are preserved |
| DELETE `/api/items/:id` | Session and owned item | `{message}`; 409 while processing, cleanup failure retains item |
| POST `/api/items/:id/retry` | Failed/completed owned item | Reuses job; 409 if queued/processing |
| GET `/api/health` | None | `{status:"ok"}` |
| GET `/webhook/whatsapp` | Meta hub.mode/verify_token/challenge | Challenge on match, 403 otherwise |
| POST `/webhook/whatsapp` | Meta JSON + X-Hub-Signature-256 | 200 after durable capture and queue writes; 401 bad signature, 400 malformed payload, 503 persistence failure |

Dates are YYYY-MM-DD in UTC and apply to the **original** item timestamp. Pagination uses timestamp plus ID to avoid ties. Search modes are `keyword`, `vector`, `hybrid` (default). Both search methods apply verified ownership and content filters; keyword fallback is explicitly reported. Ask refuses uncited/invalidly cited generated answers. Search and timeline omit embedding arrays from responses.

Webhooks process all entries/changes/messages, ignore status-only events, and do not persist unlinked or unsupported messages. Media downloads and AI run in the worker. Item/job uniqueness prevents duplicate capture; queued replies can still be delivered twice after a send/record crash. Reply jobs have priority over enrichment.

The integration tests in `server/tests/integration.test.js` run these real HTTP routes with in-memory MongoDB. They do not substitute for Meta delivery, real media storage or model-quality checks.
