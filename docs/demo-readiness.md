# Engram demo readiness

**Current status: blocked on reported backend storage configuration.** A complete hosted demo has not been certified. Local tests and an HTTP health response do not establish live storage or AI access.

## Fix the upload blocker

1. Read the connector's **Signing in to** URL. For either deployed Engram URL, the API destination is the Render backend at `https://engram-eont.onrender.com`. For `http://localhost:8000`, configure and restart that local server instead.
2. In Supabase, select the intended project. Obtain its project URL and a server-only key with privileged storage access from the project's Connect/API Keys settings. Keep values private.
3. In Render, select the **Engram backend service**, open **Environment**, and configure:

   | Variable | Value to enter privately |
   |---|---|
   | `SUPABASE_URL` | The Supabase project URL. |
   | `SUPABASE_SERVICE_ROLE_KEY` | The project's privileged backend storage key. This is the variable name read by the current application; an anon/publishable key is not a substitute. |
   | `CLOUDFLARE_ACCOUNT_ID` | The Workers AI account's 32-character hexadecimal ID. |
   | `CLOUDFLARE_API_TOKEN` | A token with access to the configured Workers AI services. |
   | `CLIENT_ORIGIN` | `https://engram-beryl.vercel.app` for this frontend. |

   Keep the existing `MONGODB_URI` and `JWT_SECRET` configuration. These belong on the backend, not in the connector or frontend.

4. In Supabase Storage, create or confirm the bucket **`engram-media`** is **private**, accepts JPEG/PNG/WebP/PDF and permits files up to the application's 10 MB limit. A public bucket is not an upload-error fix.
5. In Render choose **Save and deploy** and wait for deployment completion. **Save only** does not apply values to the running process. The storage client is constructed at server startup, so the process must restart.
6. Keep the connector open. It retains the queued file and retries temporary upload failures. If its Engram login has expired, restart it and sign in; reuse the WhatsApp session unless pairing itself is broken. Do not resend repeatedly and create extra items.

Official references: [Render environment settings](https://render.com/docs/configure-environment-variables), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [private Storage and signed downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## Check backend dependencies before recording

After deploying the current source, run these **from `server/` in the backend environment** if a hosting shell is available:

```sh
npm run demo:preflight
node scripts/checkStorage.mjs
node scripts/checkAiAccess.mjs
node scripts/searchIndexes.mjs
```

The preflight reads only the process environment; it does not load a private environment file or print credential values. For local use, supply configuration privately to the process. Running it on a different machine cannot verify Render's configuration.

- **Configuration:** no missing variables or invalid origin/account formats. This checks presence and format, not whether credentials work.
- **Storage:** private bucket, synthetic upload, signed download and test-file cleanup all print PASS. The probe does not read saved user media. Use `node scripts/checkStorage.mjs --create-bucket` only when intentionally creating the missing private bucket.
- **AI:** synthetic JSON generation and a 768-dimensional embedding both print PASS. Do not accept model terms automatically; review [Cloudflare setup](cloudflare-setup.md) if access is denied.
- **Search:** `text_index` and `vector_index` are queryable and match the configured model/filter fields. Follow [local setup](../README.md#local-setup) if indexes need provisioning.

No hosting shell? Complete the live application checks below. A passing local provider probe does not prove the hosted process has the same settings.

## Complete the real demo path

Use a dedicated account and the synthetic content from [demo-script.md](demo-script.md). Record results only after performing each action:

- [ ] Sign in, refresh successfully, and confirm logout requires sign-in again.
- [ ] Capture a new ordinary text note and confirm it reaches `done`.
- [ ] Upload/capture a readable screenshot and selectable-text PDF. Both finish processing; extracted text matches their original content.
- [ ] Open each original through **View file**. Confirm signed media access works.
- [ ] Find one known keyword match and one meaningful semantic match; no dependency-fallback warning is present for the semantic check.
- [ ] Use **Ask AI** and verify its answer and cited source against the PDF. Confirm an unrelated query has an appropriate empty/not-found result.
- [ ] Bookmark an item, edit its heading/tags/category, refresh and confirm persistence.
- [ ] Unlock a synthetic Confidential item, lock it again, and confirm normal search/Ask excludes it.
- [ ] Confirm a second account has its own library. Automated ownership tests supplement this visible check.
- [ ] Demonstrate a real Retry after fixing its cause, or label the action **Reprocess** when using a completed item.
- [ ] If filming WhatsApp capture, send a new message and show its actual arrival. Do not use local parser tests as pairing evidence.

Only mark the release demo ready after these checks pass on the same deployment being recorded. The benchmark and public video link remain separate deliverables; do not invent search scores or hide provider failures.

## Local regression commands

```sh
cd server
npm test
cd ../connector
npm test
cd ../client
npm run build
```

The native test suite uses isolated data; it does not validate real provider credentials, hosted Atlas relevance or live WhatsApp pairing. Keep that distinction when reporting readiness.
