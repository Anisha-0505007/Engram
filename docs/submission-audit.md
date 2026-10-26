# Engram submission audit

Audit date: 27 October 2026.
Baseline source: main at `56090aa`. This pass also fixes the bookmark projection issue described below and updates the documentation.

## Assessment

Engram contains meaningful application logic beyond basic CRUD or a simple LLM wrapper: authenticated private capture, durable jobs, deduplication, retry/quota behavior, text/vector retrieval, privacy controls and correction workflows.

**It cannot yet be marked as satisfying every submission requirement.** A hosted new-account AI processing failure remains unresolved, a complete fresh-account hosted workflow has not been certified, and the demo video/form completion have not been verified. These are release obligations, not optional feature additions.

## Requirement mapping

| Submission area | Evidence and current status |
|---|---|
| Problem and product understanding (10%) | Problem, target users and four core workflows are documented. Satisfied at documentation/design level. |
| Core implementation (25%) | Capture, accounts, persistence, processing, browse, correction and retrieval exist in source. Local tests cover important paths. Fresh hosted AI success still needs confirmation. |
| Engineering and application logic (20%) | Mongo job claims, deduplication, retries, stale-lock recovery, quotas, owner filtering, RRF and media handling are implemented. Real provider availability/relevance is not established by mocks. |
| Architecture and decisions (15%) | Current Vercel-to-Render proxy and same-process worker are documented with a diagram, reasons and prototype trade-offs. |
| UX and reliability (10%) | Loading/empty/error/retry states, saved-item statuses and signup guidance exist. Hosted login has a proxy fix; repeat the complete browser flow before recording. |
| Code quality and structure (10%) | Routes/controllers/services/models/worker are separated; tests and an API contract exist. Historical learning notes are not a current implementation specification. This audit is not an exhaustive code-quality proof. |
| Deployment and documentation (10%) | Public frontend and backend health routes respond. README/setup are updated; a demo recording and submission confirmation are still missing. |

No numeric grade is assigned: grading belongs to the evaluator, and code/test evidence is different from a complete hosted demonstration.

## Checks run in this audit

| Check | Result and scope |
|---|---|
| Backend `npm test` | Final run: 49 tests, 46 passed, 3 optional simulations skipped, 0 failed; exit 0. Includes the new bookmark regression. |
| Connector `npm test` | 12 passed, 0 failed; exit 0. This verifies parser/outbox/client behavior, not real WhatsApp pairing. |
| Frontend `npm run build` | Passed; Vite emitted `client/dist`. This is a production compilation check, not a full browser test. |
| Public frontend `/login` | HTTP 200. |
| Frontend `/api/health` | HTTP 200 with `{"status":"ok"}`; API proxy response has `private, no-store`. |
| Render `/api/health` | HTTP 200. This endpoint does not check model credentials, model quality or every database operation. |
| Anonymous frontend `/api/auth/me` | HTTP 401 as expected. This verifies authentication is enforced, not that a real account completed login. |
| Secret/file checks | 124 tracked text files checked for recognizable key/token patterns; no matches. No tracked or historical private environment/session/outbox paths found. Strong-pattern Git-history check found no matches. Private environment files were not opened. |
| Git history | 24 commits on main at the reviewed baseline; development history is present. |
| Optional Postman simulations | The 3 opt-in tests were skipped in the baseline run; earlier recorded simulation observations are not rerun evidence for this audit. |
| Search quality benchmark | Not measured; no invented accuracy or recall figures. |
| Documentation checks | All 9 required README sections present; 15 local documentation links checked with no broken targets. |

The backend run emitted a canceled-download warning and expected failed instruction-reply messages from unconfigured external integrations; the test runner still reported zero failed tests. This does not certify live WhatsApp service.

Security checks were bounded pattern/filename scans. They cannot prove that every secret format, dependency vulnerability or authorization edge case has been eliminated. Local isolation tests use a temporary in-memory database, not the hosted users' private content.

### Bookmark projection correction

Source review found that semantic-result projection omitted `bookmarked` before a later bookmark-section filter. This could lose bookmark state or drop matching vector results. The correction preserves that field.

A regression test applies the actual projection followed by the owner/bookmark filter in in-memory MongoDB, with a fixed score replacing unsupported Atlas metadata. It checks that only the owner's bookmarked item survives. It does not run the Atlas vector engine.

The new regression failed before the field correction (the bookmarked result was lost), then passed with the fix. The final full backend run passed 46 tests, skipped the same 3 opt-in simulations and reported zero failures.

## Must finish before claiming a complete release

- [ ] On a fresh account at https://engram-beryl.vercel.app, save an ordinary, non-confidential text note and confirm it reaches **done**.
- [ ] Resolve the reported Cloudflare credentials error on the backend process handling jobs. Its check occurs before per-user quotas; old completed records do not prove present configuration.
- [ ] If settings have changed, click Retry on the failed item; stored failure text does not clear by itself.
- [ ] Confirm login survives a full refresh and logout requires login again.
- [ ] Upload a harmless image and PDF, confirm extraction/searchability, and open authorized media links.
- [ ] Confirm one known keyword match, one meaningful semantic match, a tested Ask answer with valid sources, and an absent-query response. Read fallback warnings.
- [ ] Check bookmark/heading persistence, ordinary versus Confidential access, and distinct libraries in two browser profiles/accounts.
- [ ] Record a 3-5 minute video using [demo-script.md](demo-script.md), publish it, and add its actual URL to README and the form.
- [ ] Open source, application and video links in incognito/private mode and confirm evaluator access.
- [ ] Fill [the official submission form](https://forms.gle/sBy4sfqyiRG2Zpom9) before 27 October 2026, 11:59 PM IST. Form submission has not been performed by this audit.

## Optional or limited capabilities

- The official WhatsApp integration has local signature/parser/idempotency tests, but real delivery/replies are not certified here.
- The unofficial personal connector's tests do not establish live pairing. Do not make optional pairing a prerequisite for an evaluator's web demo.
- A Windows installer exists locally but is Git-ignored. The usual Render build does not distribute it; hosted authenticated download is unverified.
- Search relevance needs a real evaluation dataset. In-memory MongoDB does not execute Atlas Search/Vector Search.
- Privacy detection and model-generated extraction are fallible. Confidential is an access control, not end-to-end encryption.
- A functioning HTTP health endpoint is not a provider-readiness check.
