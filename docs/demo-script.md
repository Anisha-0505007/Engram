# Engram demo video script

Target: 4 minutes 30 seconds, within the recommended 3-5 minutes.

This is a recording script, not evidence that the hosted workflows have passed. Use the real deployed application and show real results. Replace bracketed values before recording.

## Before recording

1. Open https://engram-beryl.vercel.app in a clean browser profile. Confirm login persists after refreshing.
2. On a fresh account, save an ordinary non-confidential note and wait for **done**. Resolve the reported Cloudflare credentials failure before describing enrichment, semantic search or Ask as working.
3. Verify the actual link, image/PDF, search query and Ask answer you plan to show. Confirm cited sources contain the answer. Use a search query that really matches your saved fixtures.
4. Prepare a second browser profile/account with a different library for the isolation step. Do not put personal documents, real identity numbers, API keys or passwords in the recording.
5. Choose an example with no privacy-sensitive content. Keep one completed image/PDF ready so the recording does not depend on provider latency.
6. If you plan to show a reminder, save a clearly dated event within the next 24 hours. Use the actual recording date/time; do not promise an urgent reminder for a distant event.
7. Keep the README architecture diagram open in a second tab. Hide bookmarks, unrelated tabs, desktop notifications and environment settings.
8. Record a 10-second audio check. Do not expose an account password while switching profiles.
9. Optional WhatsApp capture may replace part of the web-capture section only after live pairing and ingestion have actually been tested. Quick Add is the primary evaluator path.

Suggested synthetic demo material:

- A note: "Internship preparation: revise JavaScript, React, APIs and database indexing before submitting my application."
- A link: "Engram project source: https://github.com/Anisha-0505007/Engram".
- An image or one-page PDF you create containing readable workshop notes. Label it as synthetic demo content.
- A short note explicitly marked Confidential before saving, such as "Private demo note: discuss my study plan." It does not need to contain a real secret.
- A throwaway note for deletion, if you want to show that instead of a retry.

## 0:00-0:25 | Problem and users

**Show:** the application home/sign-in page. A brief synthetic list of mixed notes, links and screenshots can illustrate the problem.

**Say:**

> Hi, I'm [your name], and this is Engram. I built it for students and young professionals who save useful notes, links, screenshots and documents, then struggle to find them later. Engram turns those saved things into a private, searchable library.

Do not spend time reading the entire feature list.

## 0:25-0:50 | Enter a private library

**Show:** sign in to the demo account, then open All items. If demonstrating signup, show the welcome tour briefly and dismiss it.

**Say:**

> Each person has their own account and library. You can try the main workflow directly in the browser without connecting WhatsApp. This dashboard shows saved items and their processing state.

**Verify on screen:** the account is authenticated, the library belongs to it, and navigation works.

## 0:50-1:35 | Save, process and preserve

**Show:** use Quick Add to save the synthetic ordinary note. Show pending/processing. Open a completed link and the prepared readable image/PDF.

**Say:**

> I save a note here, and Engram stores the original immediately. A durable background job then extracts useful text, generates labels and builds a searchable representation. The request doesn't need to wait for all that processing. This image [or PDF] has readable text available in its details, while the original file remains accessible.

If processing has not finished, show the real state and a different previously verified item. Say which is newly processing and which was prepared earlier. Do not describe pending or failed work as done.

**Optional WhatsApp replacement, only if verified:**

> This optional local connector captures new messages from my own Message Yourself chat and sends them into the same pipeline. It runs on my computer and must stay open.

Show a real new message arriving. Do not show pairing codes or imply that the website can read arbitrary private chats.

## 1:35-2:20 | Find information and check sources

**Show:** a tested subject search, a saved-date or type filter, then a tested Ask query. Open one of its actual source cards.

**Say:**

> I can search my saved content by words or meaning and narrow it with filters. Keyword matches and semantic results are combined using rank fusion. Ask uses retrieved saved items and links back to their sources, so I can check the original rather than trust an answer without context.

Ask "Where did I save the Engram project source?" only if that exact saved source is retrieved correctly.

Then show a genuinely absent query if time permits:

> When no relevant saved source is found, it tells me that instead of presenting a made-up source.

Do not call a keyword-fallback result a successful semantic match. If the UI reports a fallback warning, describe it accurately.

## 2:20-2:50 | Organize and correct

**Show:** bookmark a completed ordinary item, open Bookmarks, edit its heading, and refresh to show persistence.

**Say:**

> I can bookmark an item and find it in its own section. I can also correct the heading, category and tags. Those edits are stored separately from AI-generated metadata, so reprocessing preserves my corrections.

If you show Upcoming, distinguish the saved date from an event date mentioned inside the content. Reminders are in-app only.

## 2:50-3:20 | Confidential access

**Show:** open Confidential while locked, unlock with the current account password, view the synthetic private note, then lock again.

**Say:**

> Confidential content requires an additional password unlock. It stays out of ordinary search and AI answers. Marking a note confidential before saving skips AI processing. This is an access control feature, not end-to-end encryption, and automatic detection is not a perfect privacy guarantee.

Keep the synthetic note short and avoid displaying real documents.

## 3:20-3:50 | Reliability and account isolation

**Show:** a real failed demo item and its Retry action after its cause has been fixed. Then briefly switch to the second account/profile and show its different library.

**Say:**

> A failed dependency doesn't erase the original. Engram shows a processing error and allows retry. Work is stored in a job queue with retry limits and recovery for interrupted jobs. This second account has its own library; the backend checks ownership on private item operations.

If no failed item is available, demonstrate a rejected invalid input or deletion of the throwaway item instead. Do not break shared production credentials to manufacture a failure for the video.

The visible second library illustrates the workflow; the automated cross-user API tests provide stronger isolation evidence. Do not claim that one screenshot proves every authorization path.

## 3:50-4:30 | Engineering and closing

**Show:** README architecture diagram, then return to the deployed application.

**Say:**

> React is hosted on Vercel. API requests are forwarded to an Express backend on Render, which also runs the worker. MongoDB stores the items and durable jobs, Cloudflare provides AI processing, and private Supabase storage holds media.
>
> The main engineering decisions are ownership checks, duplicate-safe capture, asynchronous jobs with retry, and keyword-plus-vector retrieval. I used one backend and a Mongo job collection to keep the system manageable.
>
> The repository documents setup, checks and limitations. Engram's goal is simple: save quickly, and find the things that matter later. Thank you.

Only say the demonstrated AI flow works after the recording actually shows it. Do not claim measured search accuracy, successful WhatsApp capture or load capacity without evidence.

## After recording

- Watch the complete video: readable screen, audible narration, no credentials or personal content.
- Upload it to an evaluator-accessible destination. Open the link in an incognito/private window without signing in to verify access.
- Add the real video URL to README and the submission form.
- Use [submission-template.md](submission-template.md) to fill the required fields.
- Complete the official form before **27 October 2026, 11:59 PM IST**. A script or a GitHub push does not submit the project.
