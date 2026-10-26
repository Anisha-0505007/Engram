# Cloudflare AI setup

Cloudflare is Engram's only AI provider. No Worker deployment, SDK or Groq key
is required: Express calls the Workers AI REST API using Node's native fetch.

## Credentials

1. Sign in to Cloudflare and open **Workers AI > Use REST API**.
2. Select **Create a Workers AI API Token**, review the template and create it.
   A manually created token needs **Workers AI Read** and **Workers AI Edit**
   permissions for the chosen account. Use the template to avoid a global key.
3. Copy that account's Account ID (32 hexadecimal characters).
4. Privately set these server environment variables, locally and in Render:

```text
CLOUDFLARE_ACCOUNT_ID=your_32_character_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_token
DAILY_AI_CALL_LIMIT=100
```

For local development, edit `server/.env` yourself. Never paste the token into
chat, browser code, screenshots or Git. Restart the server after configuration.
`AI_PROVIDER`, `GROQ_API_KEY` and Gemini settings are no longer used.

## Models and first request

- Text, JSON, image OCR, query understanding and Q&A:
  `@cf/meta/llama-3.2-11b-vision-instruct`.
- Embeddings: `@cf/baai/bge-base-en-v1.5`, 768 dimensions.
- PDF text: Workers AI `toMarkdown`, followed by text enrichment.

The vision model requires acceptance of Meta's license and acceptable use policy.
Review the terms linked on its model page first. If you agree, from `server/` run:

```powershell
node scripts/checkAiAccess.mjs --accept-model-terms
node scripts/checkAiAccess.mjs
```

The second command sends synthetic text only and must print PASS for generation
and JSON, then PASS for a 768-dimensional embedding. It does not verify image or
PDF quality, Atlas indexes, or Render's environment. Check those with a synthetic
image and selectable-text PDF through Quick Add after restarting/deploying.

Use **Reprocess** for items embedded with a previous provider. Equal vector
dimensions do not make embeddings from different models compatible.

If the vision model returns 403, isolate model access with this text-only probe:

```powershell
node scripts/checkAiAccess.mjs --alternate-model
```

It tests `@cf/meta/llama-3.2-1b-instruct` and independently tests embeddings, even
if generation fails. This does not change the app's vision model. A successful
text probe does not establish image support. Both probes returning 403 suggests
an account/token access issue rather than just the original model restriction.

## Free allowance and errors

Docs checked 2026-10-26: the Workers Free plan includes 10,000 neurons per day,
resetting at 00:00 UTC (05:30 IST). Further requests fail when exhausted. Stay on
the Free plan to avoid paid overage. `toMarkdown` is free for most conversions;
some image-related conversion work can consume the AI allowance.
`DAILY_AI_CALL_LIMIT` is Engram's per-user call budget, not a neuron budget or
a guarantee that the shared provider allowance cannot be exhausted.

- 401/403: check the correct account ID, token permissions and model terms.
- 429: check the dashboard for rate limits or exhausted daily allocation.
- Network error: check connectivity; the client times out after 30 seconds.

Live checks on 2026-10-26 passed JSON generation, 768-dimensional embeddings,
and a synthetic one-pixel image request after resolving the model's initial 403.
Text requests use chat messages; image requests use prompt plus image bytes.
Meaningful image/PDF extraction quality and Render configuration remain unverified.

Sources: [REST setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/),
[vision model and terms](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/),
[embedding model](https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/),
[pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/),
[PDF conversion](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/).
