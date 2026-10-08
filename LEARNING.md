# Learning Log

This file tracks my understanding of the concepts used in the Engram project.

## Study Later
*(Items I skipped understanding during the gate, to review later)*
- (None yet)

## F0 — Project Setup & Deployment (Oct 5)
- What I built: An Express "Hello World" server connected to MongoDB, deployed on Render.
- Why it's built this way (and one alternative I rejected): We deployed first so we have a live HTTPS URL for Meta webhooks. We chose Render over AWS EC2 because Render manages the servers for us.
- One thing that broke / could break, and why: Not using `process.env.PORT` could break the app because Render assigns the port dynamically. 
- Explain it in 2 sentences (my own words): I set up a basic server that talks to a database and put it on the internet. I hid the secret keys in a `.env` file so hackers can't find them and manipulate my database.
- Study later (if I skipped understanding something): N/A

## F1 — Auth: register/login/logout/me + React shell (Oct 5)
- What I built: Register/login/logout API with bcrypt + JWT in httpOnly cookies, plus a React shell with protected routes (Dashboard redirects to /login if the cookie is invalid).
- Why it's built this way (and one alternative I rejected): JWT in an httpOnly cookie blocks XSS token theft because JS on the page can never read it. Alternative: store the JWT in localStorage — simpler, but any XSS script can steal it and impersonate the user forever.
- One thing that broke / could break, and why: If we read `userId` from `req.body` instead of `req.userId` (set by the middleware from the verified JWT), any logged-in user could pass another user's ID in the body and access their data — a classic authorization bypass.
- Explain it in 2 sentences (my own words): I hash passwords with bcrypt so even if the database leaks, attackers can't reverse the hash. I put the JWT in an httpOnly cookie so JavaScript can never touch the token, and I only trust the userId the server verified from that token — never what the client sends in the request body.
- Study later (if I skipped understanding something): N/A

## F2 — Webhook Signature Verification (Oct 8)
- What I built: An Express webhook route that captures raw request bytes, and a controller that verifies Meta's HMAC SHA-256 signature against it using a timing-safe comparison.
- Why it's built this way (and one alternative I rejected): We verify the HMAC using the raw body bytes instead of the parsed JSON because parsing and re-stringifying changes whitespace and key order, invalidating the hash. I used `crypto.timingSafeEqual` instead of `===` to prevent timing attacks.
- One thing that broke / could break, and why: If `timingSafeEqual` receives two buffers of different lengths, it throws a fatal error, which would crash the server or drop the request unexpectedly. We must explicitly check lengths first.
- Explain it in 2 sentences (my own words): I used a secret key to re-create the signature on the exact bytes Meta sent us, making sure no one else can forge requests. I compared the two signatures using a special function that takes the exact same amount of time no matter what, defeating stopwatch-based guessing.
- Study later (if I skipped understanding something): N/A

## F3 — Link-Code Flow & Idempotent Insert (Oct 8)
- What I built: Models for LinkCode and Item. A webhook parser that links a user's phone if they send a 6-digit code, and idempotently saves their messages as pending items.
- Why it's built this way (and one alternative I rejected): We catch the MongoDB 11000 duplicate key error instead of checking `findOne` first, because `findOne` is vulnerable to race conditions if two webhooks arrive at the exact same time. Rejected alternative: "Check then insert" (read-modify-write) which fails under concurrent load.
- One thing that broke / could break, and why: If we didn't add `sparse: true` to the `waMessageId` unique index, we would never be able to add items from the web dashboard, because they would all share a `null` or missing waMessageId, triggering a duplicate key error!
- Explain it in 2 sentences (my own words): Idempotency means doing the same thing twice has the same result as doing it once, preventing duplicate saves when Meta retries a webhook. We let the database enforce this rule at a low level, which is much safer than trying to check manually before saving.
- Study later (if I skipped understanding something): N/A
