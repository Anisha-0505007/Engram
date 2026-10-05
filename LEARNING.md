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
