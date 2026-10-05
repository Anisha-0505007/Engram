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
