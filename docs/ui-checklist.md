# UI check before submission

Open http://localhost:8000 locally. The hosted site will use the new code only after deployment.

1. Register or sign in. Refresh `/dashboard` and confirm you remain signed in.
2. Save a note with a distinctive phrase. See pending → processing → done, or a clear error with Retry if a provider fails.
3. Paste a public article link. Open the title after enrichment. A dead link should stay saved with a partial notice.
4. Upload a screenshot, then a small PDF. Use View file and Extracted text. Uploading HTML disguised as a PDF must fail.
5. Search exact words and synonyms. Check the dependency warnings: keyword fallback must never pretend semantic search ran.
6. Use type/date/category filters. Use Ask AI and click a source to jump to its item. Ask about absent information; expect a refusal.
7. Edit tags/category, including clearing all tags. Reprocess and confirm the edits remain.
8. On a failed item click Retry. Wait for processing to finish, delete it and confirm it disappears. Storage failures must be visible.
9. Get Link Code; send it from a whitelisted WhatsApp number to the configured business number. Confirm linked status updates without refreshing. Forward two messages, then an image; confirm one item per message and bot acknowledgements.
10. Sign in as another account in incognito and confirm the first account's items are absent. Sign out and confirm the dashboard redirects to login.
11. Test the same flow on the deployed URL in incognito. Record the actual result; local tests do not establish deployment or real provider behavior.

Known release limits: no PDF chunk retrieval, chat export import, voice transcription or in-WhatsApp search; evaluation scores remain unmeasured until the runner has real expected IDs. PDF extraction is model-generated and may omit text.
