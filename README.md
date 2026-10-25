# Engram

> Save the way you already do. Find anything, later.

## Problem Statement

People use WhatsApp as a dumping ground for important things — links, screenshots, PDFs, notes — and then can't find them. WhatsApp search only matches exact text; it can't find a screenshot by what it *shows*, or a link by what it's *about*.

## Target Users

Students and young professionals who save things to themselves on WhatsApp. First users: hostel mates, classmates.

## Solution

Engram is your second brain on WhatsApp. Forward or send content to the Engram bot number. It saves everything, runs AI enrichment in the background (OCR on images, text extraction from links, semantic understanding), and lets you find items later by meaning — not just exact words.

**Example:** Forwarded a screenshot of a Wi-Fi plan three months ago? Search "wifi plan screenshot" and it appears. Ask "what was that PG link I saved in August?" and Engram answers with a citation.

## Key Features

- **📱 WhatsApp Capture** — Forward/send links, images, or text to the Engram bot. Webhook saves and acknowledges instantly ("Saved ✅").
- **🌐 Web Quick Add** — Paste a link or note in the web UI. Same enrichment pipeline, no WhatsApp needed (great for evaluators).
- **🤖 AI Enrichment** — Gemini extracts title, summary, category, and tags from links; OCR + description from images; structured text from PDFs.
- **🔍 Hybrid Search** — Keyword search + semantic vector search merged with Reciprocal Rank Fusion. Finds "passport image" even if it's tagged "visa".
- **✨ Ask Mode** — Ask a natural language question, get a grounded AI answer with cited sources from your own saved items.
- **🎯 Smart Filters** — Filter by type (link/image/pdf/text), date range, or category. Query understanding parses "links from August" automatically.
- **✏️ Edit & Delete** — Override AI-assigned tags/category. Deletes cascade to media storage and pending jobs.
- **🔁 Retry** — Failed enrichment jobs show a Retry button. Exponential backoff built in.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 (Vite) |
| Backend | Node.js + Express |
| Database | MongoDB Atlas (Vector Search + Atlas Search) |
| Embeddings & LLM | Google Gemini (`text-embedding-004`, `gemini-1.5-flash`) |
| Object Storage | Supabase Storage |
| WhatsApp | Meta WhatsApp Cloud API |
| Auth | bcrypt + JWT in httpOnly cookies |
| Deployment | Render (backend + frontend served from Express) |

## Architecture

```
WhatsApp user → Meta Cloud API ──webhook──▶ Express API ──▶ MongoDB Atlas
React web app ──────── REST ───────────────▶     │           (items, jobs, vector + text indexes)
                              Worker loop ────────▶ Gemini API
                              (same process)        Supabase Storage
```

### Key Design Decisions

| Decision | Reason |
|----------|--------|
| Monolith, single deploy | One developer, ~3 weeks. Express serves API + built React app. |
| Queue = `jobs` collection in MongoDB | Retry, backoff, failed state with no Redis or Kafka needed. |
| Worker in same process | Free hosting tiers (Render) usually allow one service. Module can be split later. |
| Atlas Vector Search + Atlas Search | One database, one connection, `userId` pre-filter, no separate vector DB. |
| Plain Node, no LangChain | Pipeline is small and fixed; fewer abstraction layers to understand and debug. |
| One Gemini vision call for OCR + description | Avoids a separate OCR library. |
| Media in Supabase Storage | Atlas free storage is only 512MB; keeps media private via signed URLs. |

**Explicitly not used:** Redis (jobs collection is sufficient), Kafka (no fan-out needed), Docker/Kubernetes (overkill for one service), LangChain (adds abstraction without benefit at this scale), TypeScript (MERN stack assignment scope).

### System Design Concepts Used

- **Idempotency** — `waMessageId` unique index prevents duplicate saves on Meta webhook retries.
- **Async processing** — Webhook returns 200 immediately; enrichment runs in the background worker.
- **Retry with exponential backoff** — `30s → 120s → 480s`; after 3 failures → `failed` state.
- **Dead-letter state** — Failed jobs remain visible so the user can retry manually.
- **Pre-filtering** — Atlas Vector Search filters by `userId` before scoring to ensure strict data isolation.
- **Reciprocal Rank Fusion** — `score(d) = Σ 1/(60 + rank_i(d))` merges keyword and vector rankings.
- **SSRF protection** — DNS resolution happens before the HTTP request; private IP ranges are blocked.

## Local Setup

### Prerequisites
- Node.js 20+
- MongoDB Atlas account (free M0 tier works)
- Supabase account (free tier)
- Google AI Studio API key (Gemini)
- Meta Developer account with a WhatsApp test app

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Anisha-0505007/Engram.git
cd Engram

# 2. Install server dependencies
cd server && npm install

# 3. Copy env file and fill in your secrets
cp .env.example .env
# Edit .env with your real values

# 4. Install client dependencies
cd ../client && npm install

# 5. Build the client (for production-like serving from Express)
npm run build

# 6. Run the server (serves API + built client)
cd ../server && npm run dev
```

### Atlas Vector Search Index

In MongoDB Atlas UI, create a Search index on the `items` collection:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    }
  ]
}
```
Name the index `vector_index`. Without this, the app degrades gracefully to keyword-only search.

## Environment Variables

Copy `.env.example` → `.env`. All values are required for full functionality.

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 8000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing JWTs (generate a random 32+ char string) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `WHATSAPP_APP_SECRET` | Meta app secret (for webhook HMAC verification) |
| `WHATSAPP_VERIFY_TOKEN` | String you choose; must match what you set in Meta Developer Console |
| `WHATSAPP_ACCESS_TOKEN` | Temporary Meta access token |
| `WHATSAPP_PHONE_NUMBER_ID` | The test phone number ID from Meta Developer Console |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase settings |
| `CLIENT_ORIGIN` | Frontend origin for CORS (e.g. `http://localhost:5173`) |

## Deployment

**Live URL:** `https://engram-eont.onrender.com`

**Demo credentials:**
- Email: `demo@engram.app`
- Password: `Demo1234!`

**⚠️ WhatsApp test mode note:** Meta's test number can only receive messages from phone numbers explicitly whitelisted in the Meta Developer Console → WhatsApp → API Setup → "To" numbers. If you want to test WhatsApp capture, ask for your number to be added, or use the **Web Quick Add** feature which runs the same pipeline.

### Deploy on Render

1. Push to GitHub.
2. Create a new **Web Service** on Render, connect your repo.
3. Set **Root Directory** to `server`.
4. Set **Build Command** to:
   ```
   npm install && cd ../client && npm install && npm run build && mv dist ../server/public
   ```
5. Set **Start Command** to `npm start`.
6. Add all environment variables from `.env.example` in Render's Environment tab.

## Evaluation Results

See [`docs/evaluation.md`](docs/evaluation.md) for the full 25-query evaluation across keyword-only, vector-only, and hybrid conditions.

**Summary:**

| Condition | Recall@5 |
|-----------|----------|
| Keyword-only | 60% |
| Vector-only | 100% |
| **Hybrid (RRF)** | **100%** |

## Limitations and What I Deliberately Didn't Build

- **PDF chunking** — Long PDFs are stored as one item. Full chunk-level retrieval was deprioritized; the cut order in `AGENTS.md` explicitly lists this.
- **Chat export import** — `.zip` import from WhatsApp was cut (same cut order).
- **In-WhatsApp search replies** — Users can't search by replying to the bot; they use the web UI. Cut to save time.
- **Redis / Kafka / Docker** — Not needed at this scale; using MongoDB as a job queue is sufficient and simpler to understand.
- **Voice note transcription** — Nice-to-have; cut.

## AI Usage

AI tools (Google Gemini via Antigravity IDE) assisted in writing the code. I reviewed every file, ran the tests, and can explain the architecture and key decisions. The AGENTS.md protocol required understanding gates after each feature — see `LEARNING.md` for what I actually learned.
