# Engram — Final Demo Video Script

**Target length:** 4 minutes 30 seconds. Read the quoted narration; the action notes are for the recording only.

**Application:** https://engram-beryl.vercel.app

**Repository:** https://github.com/Anisha-0505007/Engram

## Recording setup

Use a dedicated demo account containing only synthetic material, plus a second account in another browser profile. Keep the application, the README architecture diagram and the local test results ready in separate tabs. Record at a readable browser zoom with notifications off.

Rehearse the exact searches and Ask question below on the deployed application. Confirm a newly saved ordinary note reaches `done`, media opens and the answer's sources contain the stated facts. The [submission audit](submission-audit.md) records an unresolved hosted AI configuration failure; this script does not establish that it has been fixed. If it persists, use the honest failure wording at the end rather than presenting AI success.

The current frontend has **no Quick Add or upload form**. Capture endpoints exist, but the recording must not refer to a nonexistent button. For the capture segment, choose either a genuinely working WhatsApp connection or the authenticated API alternative provided below. Prepare and pair any connector before recording; do not film credentials or pairing codes.

### Prepare these demo items

| Item | Exact synthetic content | Purpose |
|---|---|---|
| Text note | `Interview preparation: revise JavaScript closures, React state, Express APIs and MongoDB indexes.` | New capture and processing. |
| Link | `Engram project source: https://github.com/Anisha-0505007/Engram` | Links section and opening the original. |
| Screenshot | `DEMO Wi-Fi plan. Campus Basic. Speed: 100 Mbps. Price: Rs 499 per month.` | Image extraction, keyword and meaning-based searches. |
| One-page PDF | `DEMO Library Policy. Students may borrow up to three books for 14 days. Return books at the library desk.` | PDF extraction and a source-linked answer. |
| Confidential note | `Private demo note: discuss my study plan.` | Password unlock without revealing real private content. |

The matching [demo assets](demo-assets/README.md) include a labelled Wi-Fi image, a selectable-text library-policy PDF and the note text. Add them through the tested capture route and let them finish processing before recording. Use the API helper at the end to create the Confidential note with `confidential: true`; its ordinary text is deliberately not something automatic detection should classify as sensitive.

Keep the live-capture note unsaved until its segment. Prepare a completed ordinary text item for **Reprocess**, or a real failed text item whose underlying problem has been corrected for **Retry processing**. Avoid using unclassified media for this step because it remains hidden from ordinary lists.

## 0:00–0:20 | The problem

**On screen:** show the prepared mix of a note, link, screenshot and PDF, then the Engram sign-in page. Use synthetic content throughout.

**Say:**

> We save useful things every day: a link for later, a screenshot of a plan, or a document we might need. Weeks later, we remember what it was about, but not the exact words. Engram turns those saved things into a personal, searchable library.

## 0:20–0:40 | Enter the application

**On screen:** click **Sign in**, open **All items**, and briefly point to **Links**, **Photos**, **Upcoming**, **Bookmarks** and **Confidential**. Refresh once to show that the login persists.

**Say:**

> This is the deployed application. Each account has its own library. I can browse everything together or open sections for links, photos, upcoming events and bookmarks. Sensitive items have a separate password-protected section.

## 0:40–1:20 | Capture and background processing

**Choose one take. Read only the matching narration.**

### Take A — Working personal WhatsApp connector

**On screen:** with the already paired local connector running, send the interview-preparation note to **Message Yourself**. Return to Engram, open **All items** and click **Refresh**. Show the actual item and its status. Briefly show the source label **Personal WhatsApp**.

**Say:**

> I send this new note to my own Message Yourself chat. A local connector captures it and sends it to Engram. It is an optional, unofficial integration that runs on my computer and must stay open. Engram stores the original and queues background processing. The status shows the progress while the worker prepares it for search.

**If using the official business number instead:** send to that number and show the actual arrival. Replace the first three sentences with: “I send this note to Engram's business number. The signed webhook links it to my account and saves it. This route uses Meta's Cloud API and requires an allowed test number.” Do not describe the personal connector as the official API or promise an automatic reply from the personal connector.

### Take B — Capture API, without WhatsApp

**On screen:** from the signed-in application tab, open browser DevTools and run the `saveDemoNote` helper below with the interview note. Show HTTP `201`, close DevTools, open **All items** and click **Refresh**. Show the real status.

**Say:**

> For this recording, I am using Engram's authenticated capture API. The current interface has WhatsApp setup, but no Quick Add form. This request creates a real saved item and queues the same enrichment pipeline. Here it is in the library. Processing happens in the background, while the original remains stored.

**Timing:** if processing takes longer, move to the prepared completed items. Say, “This new note is still processing; these examples completed before recording.” A visible time cut may shorten a genuine wait; do not replace a failed result with a completed fixture and imply it is the same item.

## 1:20–1:50 | Understand an image and a PDF

**On screen:** open **Photos**, choose the Wi-Fi screenshot and click **View file**. Use the item's three-dot menu → **Extracted text** if needed. Then open the prepared library-policy PDF from **All items** and show its extracted text and **View file** → **Open original PDF**.

**Say:**

> This screenshot contains a Wi-Fi plan. Engram extracts its text and creates a summary and tags, while keeping the original available. The PDF is handled similarly: its readable text becomes searchable. These are real processed demo files. I can always check the original instead of relying only on generated metadata.

## 1:50–2:25 | Search and ask with sources

**On screen:** in **Search**, enter `wifi`. Set **Content type** to `image` and show the screenshot. Clear the filter. If rehearsed successfully, search `internet subscription price` to show a query using different wording. Select **Ask AI**, enter `How many books can I borrow, and for how long?`, and open the returned PDF source card.

**Say:**

> Search combines keyword matches with semantic similarity, and I can narrow results by type or saved date. This query finds the Wi-Fi screenshot. Ask AI retrieves saved items before generating an answer. Here, the library policy supplies the borrowing limit and duration. The source card lets me check those facts against the document.

Show the actual answer; the expected facts are **three books** and **14 days**. Do not read the expected answer as though it was generated if it is missing. A visible keyword-fallback warning means semantic retrieval was unavailable for that request.

If time remains, ask a rehearsed, unrelated question such as `Where is my saved lunar rover repair manual?` and show the real not-found response. Do not promise that a query will return nothing before checking it.

## 2:25–2:50 | Organize and correct

**On screen:** on the Wi-Fi item, click **Bookmark**, then open **Bookmarks**. Click **Edit heading**, set **Message heading** to `Hostel Wi-Fi plan`, set **Category** to `personal`, and set **Tags, separated by commas** to `wifi, hostel, internet`. Click **Save changes**, refresh and show that the changes remain.

**Say:**

> I can bookmark an item and give it a heading that makes sense to me. I can also correct its category and tags. These changes are stored separately from generated metadata, so reprocessing preserves my corrections. Refreshing shows that they are saved in the database.

## 2:50–3:10 | Confidential access

**On screen:** open **Confidential** while locked. Enter the account password in the masked field and click **Unlock Confidential**. Show the synthetic private note and the unlock countdown, then click **Lock now**.

**Say:**

> Confidential requires my password again and unlocks for five minutes. These items stay out of ordinary search and AI answers. This demo note was marked confidential before saving, so it skipped AI processing. The password lock controls access; it is not end-to-end encryption.

## 3:10–3:40 | Reliability and account isolation

**On screen:** open a real failed ordinary text item's **Processing details · Retry available**, then its three-dot menu → **Retry processing**. If there is no failed fixture, use a completed ordinary text item → **Reprocess**. Show the real queued state. Switch to the second browser profile and open its **All items**.

**Say for a real failed item:**

> This item stayed saved even when processing failed. After fixing the cause, I can retry it. Jobs have retry limits and recovery for interrupted processing. This second account has a different library. The backend uses the verified account identity to check ownership, with automated tests for cross-account access.

**If showing Reprocess instead, replace the first two sentences with:**

> I can reprocess this saved item without creating another copy. The job is queued again while the original and my corrections remain stored.

An empty second library illustrates separation; it is not a complete authorization test. Do not change shared production credentials to manufacture a failure.

## 3:40–4:30 | Architecture, evidence and close

**On screen:** show the README architecture diagram, the local test summaries, and briefly `docs/evaluation.md`. Return to the deployed application for the last sentence.

**Say:**

> The frontend is React on Vercel. API requests go to Express on Render, which also runs the background worker. MongoDB stores users, items and durable jobs. Cloudflare handles AI processing, and private Supabase storage holds media.
>
> I chose a MongoDB job queue to avoid another infrastructure service. Unique capture IDs prevent duplicate items. Keyword and vector results are combined using Reciprocal Rank Fusion.
>
> Local checks passed 46 backend tests and 12 connector tests; three optional simulations were skipped. A reproducible search-quality benchmark is still pending. Reminders require the app to be open, and AI results need source checks.
>
> Engram helps people save quickly and find useful information later. Thank you.

The test counts are from the 27 October local runs. Keep their output separate from production logs. Tests do not establish live WhatsApp pairing or hosted provider availability. Do not show a search-accuracy table unless an actual evaluation run has produced it.

## Capture API helpers

These are recording/preparation instructions, not application UI. Run them only in your own signed-in demo application tab. They use the existing httpOnly session cookie; no token, password or user ID needs to be copied. Do not run them on another person's account.

### Save a note or link

Define this helper in browser DevTools:

```js
async function saveDemoNote(text, confidential = false) {
  const response = await fetch('/api/items', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, confidential }),
  });
  if (!response.ok) {
    throw new Error(`Capture failed: HTTP ${response.status}`);
  }
  return response.status;
}
```

For the live capture segment, run once:

```js
await saveDemoNote('Interview preparation: revise JavaScript closures, React state, Express APIs and MongoDB indexes.');
```

Before recording, use the same helper to prepare the link and protected note:

```js
await saveDemoNote('Engram project source: https://github.com/Anisha-0505007/Engram');
await saveDemoNote('Private demo note: discuss my study plan.', true);
```

HTTP `201` means capture succeeded, not that AI processing completed. Refresh the library and inspect the real status. Calling the ordinary web capture endpoint again creates another item; do not use repeated calls as a demonstration of WhatsApp deduplication.

### Prepare the screenshot and PDF through the upload API

If neither WhatsApp route is available, define this helper before recording, then select each synthetic demo file once. It opens the file picker without adding a product feature. Use JPEG, PNG, WebP or PDF files under 10 MB.

```js
function uploadDemoFile() {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'image/jpeg,image/png,image/webp,application/pdf';
  picker.onchange = async () => {
    const file = picker.files[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('File could not be read.'));
        reader.readAsDataURL(file);
      });
      const response = await fetch('/api/items/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dataUrl.split(',')[1],
          mime: file.type,
          caption: 'Synthetic demo content',
        }),
      });
      alert(response.ok ? 'File saved. Refresh the library.' : `Upload failed: HTTP ${response.status}`);
    } catch {
      alert('Upload failed. Check the demo file and server availability.');
    }
  };
  picker.click();
}
uploadDemoFile();
```

Upload success does not establish extraction success. Wait for the real privacy check and enrichment before using the file in the main script.

## If a dependency is unavailable

Use this replacement narration where the failure occurs:

> Capture has saved the original, but this deployment is currently reporting an AI configuration error. Enrichment and semantic search are not verified in this state. I can show the stored item, its processing details and the retry control, but I am not presenting this as a successful AI run.

If WhatsApp pairing is unavailable, use capture Take B. If AI is unavailable, record the actual limitation and shorten the AI sections; do not substitute fabricated answers, edited statuses or mocked responses. Describe completed examples as earlier processed items, without claiming they prove present provider access.

## After recording

1. Watch the full video and confirm the screen and narration agree. Check that no credentials, pairing codes or personal documents are visible.
2. Upload the recording and open its link in a private/incognito window to confirm evaluator access.
3. Add the actual video URL to the README and [submission template](submission-template.md).
4. Submit the required form using the verified application, repository and video links. Recording the demo or pushing the repository does not submit the form.
