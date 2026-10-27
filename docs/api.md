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
| POST `/api/connectors/capture` | JWT cookie; `{messageId,timestamp,type,text,media?:{data,mime}}`; original timestamp is ISO UTC, media base64 and ≤10 MB | `{itemId,status}`; duplicate ID scoped to authenticated owner reuses item/job |
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

The optional local connector authenticates through the ordinary login endpoint. The server authorizes storage to that JWT owner; it cannot independently attest that an uploaded payload originated in a self-chat. The trusted local connector filters chats before uploading. Its linked-device credentials stay on the user's computer, and this endpoint neither pairs devices nor sends WhatsApp messages.

## Ask retrieval and answer failures

Link queries include URL-bearing notes and captions, matching the Links folder. Empty or unavailable Atlas keyword results trigger an owner-filtered saved-text fallback; conversational request words are excluded. Vector neighbors must score at least 0.68 on Atlas's 0–1 vector score before they are merged, so weak nearest neighbors cannot fill the result list. Ask includes the original message and stored URL alongside extracted content. Generated factual answers require valid citations. If candidates exist but citations are missing/invalid, return candidate source cards with an explicit answer-generation warning instead of claiming nothing was found. No candidates still returns the normal not-found response. Confidential and unclassified content remain excluded.

## Custom message headings

`PATCH /api/items/:id` retains required `category` and `tags` fields and accepts optional `title`: a trimmed 1–160 character string, or `null` to restore the automatic heading. Omitting `title` preserves any existing override. The verified JWT owner and Confidential unlock checks apply. Overrides live in `userEdits.title`, survive re-enrichment, and appear in cards, keyword search text and cited source labels. Original message text stays unchanged. Heading edits update keyword text immediately; embeddings use the updated heading when the item is reprocessed.

## Connector installer download

`GET /api/connectors/download/windows` requires the normal JWT session cookie and is limited to 10 requests per minute. Returns `EngramConnectorSetup.exe` as an attachment with `Cache-Control: no-store`; 401 without valid authentication; 503 with a clear message if the deployment has no installer. The fixed release path is `connector/dist/EngramConnectorSetup.exe` relative to the repository root. No user content or pairing material is included. The dashboard opens the installed handler through `engram://connect?server=<encoded origin>`; this does not prove installation or connection status.

## Organization and privacy

List, search and Ask accept `section`: `all` (default), `links`, `upcoming`, `photos`, `bookmarks`, `confidential`.
Links includes links inside notes/captions. Upcoming includes future extracted events and lists the nearest event first, with cursor pagination. Photos includes non-confidential images without upcoming events. Bookmarks contains items explicitly marked by the owner. Sections may overlap. Dates filter the original message timestamp, not its deadline.

`timezone` accepts `UTC` (API default) or `Asia/Kolkata`. The web app uses India calendar days, including messages saved just after midnight. Natural-language saved-date parsing uses the same selected timezone.

`POST /api/items` and `/api/items/upload` accept `confidential: true` to skip external AI processing. Local text checks protect likely identity documents, card/account numbers and credentials before generation. Unmarked image/PDF classification uses Cloudflare; it is not a guarantee of local-only processing or perfect detection. New and legacy media enter the worker queue automatically when the owner opens Engram; no unlock or manual review is required. Classification is checked before media enters ordinary lists/search. A missing or invalid privacy decision triggers repair/retry instead of defaulting to non-confidential. Failed scans stay hidden. Known private content is never embedded or used in AI answers.

`GET /api/items/overview` returns counts `{confidential,classifying,classificationFailed}`, without private metadata. `POST /api/items/retry-classification` retries up to 20 failed scans for the authenticated owner, without asking the user to decide whether content is confidential. Queue uniqueness and per-item markers prevent automatic requeueing on every refresh. Existing private flags remain protected.

| Method/path | Input | Success |
|---|---|---|
| GET `/api/vault` | Session | `{unlocked}` |
| POST `/api/vault/unlock` | `{password}`; current account password, rate limited | Five-minute httpOnly unlock cookie bound to the current login |
| POST `/api/vault/lock` | Session | Unlock cookie cleared |
| POST `/api/items/:id/confidential` | Owner session and vault unlock | Protects item and clears embeddings, search text and reminders |
| PATCH `/api/items/:id/bookmark` | `{bookmarked: boolean}` | Sets the owner’s bookmark state; confidential, classifying and deleting items are excluded |
| GET `/api/items?section=confidential&q=...` | Vault unlock; optional exact text query | Private items; query runs locally without AI; Aadhaar spelling aliases supported |
| GET `/api/items/reminders` | Session | `{reminders:[{itemId,key,stage,label,dueAt,dateOnly}]}` |
| POST `/api/items/:id/dismiss-reminder` | `{key}` from reminder response | Dismisses this reminder stage only |

Private items are excluded from all normal sections and AI retrieval even after unlock. Direct media/edit/delete/retry access requires unlock. API responses use `Cache-Control: no-store`. Private file links expire after 60 seconds; an already issued link cannot be revoked by locking. The vault is an access control, not end-to-end encryption.

Extracted events contain label, exact supporting quote, UTC `dueAt`, and `dateOnly`. Relative dates use the original timestamp; explicit times are interpreted/converted to Asia/Kolkata. A date without a time stays upcoming until the end of its day in India. Missing or ambiguous dates should not be guessed; extraction is model-based and can still fail. In-app reminders poll every 30 seconds while the app is open and cover the next seven days (a rolling 168-hour window), ordered by nearest event. Stages are `week` for more than 24 hours away, `day` within 24 hours, and `hour` within one hour. Dismissal keys accept all three stages; dismissing a week-stage reminder does not suppress its later day/hour stages. Past events and events beyond seven days are omitted. Confidential and unclassified items never produce reminder previews.

Run `node scripts/checkOrganization.mjs` from `server/` for synthetic live text checks. On Windows, first run `powershell -File scripts/createOrganizationFixtures.ps1`, then add `--images` to also check synthetic PNG fixtures in `.cache/`; no personal documents are required. Update Atlas definitions with `node scripts/searchIndexes.mjs --apply`, then check index readiness. The index now includes confidential/privacyPending filter fields.
