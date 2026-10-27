# Engram ? Final Demo Video Script

Target: approximately 4 minutes 30 seconds to 5 minutes, including clicks and pauses. Follow the five sections below. Read only the quoted narration.

This version follows the working personal WhatsApp connector demonstrated by the user. The official business-number route is presented as the future deployment plan, not as verified live delivery.

Before recording: sign in, keep the connector running, and prepare the [synthetic image and PDF](demo-assets/README.md), one future event within seven days, and a harmless Confidential item. Rehearse search and Ask with the actual saved content. See [demo readiness](demo-readiness.md) for the complete checks.

## 0:00?0:30 | 1. About the project

**On screen:** Start on the Engram dashboard. Briefly show a saved link, screenshot and PDF.

> Hello, this is Engram, a personal library for the useful things we save and forget. Students and young professionals often collect links, screenshots, notes and PDFs in WhatsApp. Later, they remember the topic but struggle to find the original message.
>
> Engram brings that content into one place, organizes it, and helps users find it through search and questions about their saved information.

## 0:30?1:25 | 2. How we connect now, and the future plan

**On screen:** Open Connect ? Personal connector. With the paired connector running, send a new harmless note to Message Yourself, return to All items and refresh. Briefly point to Business number while describing the future plan. Keep pairing codes and credentials off screen.

> For the current prototype, we connect WhatsApp using a local personal connector. After signing in to Engram and linking WhatsApp as a device, I can send a new note, link, image or PDF to my own Message Yourself chat. The connector sends it to my Engram library for background processing.
>
> This is an unofficial integration. It runs on my computer, needs to stay open, and captures new self-chat messages rather than importing old chats or reading other conversations.
>
> Our planned deployment route is Meta's official WhatsApp Cloud API. Users would send or forward content to Engram's dedicated business number, and our hosted server would receive it through a webhook. That would remove the need for a local connector. The official route is implemented, but completing the Meta setup and verifying live delivery remain future work.

## 1:25?2:50 | 3. Sections, Confidential and dates

**On screen:** Open Links, Photos and Upcoming. Open Confidential while locked, unlock with the masked account password, show only synthetic content, and lock again. Show a saved timestamp, an event date and the Reminders ? Next 7 days panel. Use an event explicitly dated within the next seven days.

> The dashboard has sections for All items, Links, Photos, Upcoming, Bookmarks and Confidential. Items also have categories and tags, which I can correct when needed.
>
> Confidential adds a separate password unlock for sensitive content. It unlocks for five minutes, and these items stay outside ordinary search and AI answers. This is an access control feature, not end-to-end encryption. Automatic detection can make mistakes, and unmarked files may use external AI for classification.
>
> Engram also distinguishes two kinds of dates. The saved date tells me when the original message was sent. The event date is a deadline or appointment mentioned inside its content. A message saved today might describe an event next week.
>
> Saved-date filters help find older messages. Upcoming organizes future events by their event dates. The reminders panel shows events in the next seven days, with closer reminders within twenty-four hours and urgent reminders within one hour. These reminders update while the application is open.

## 2:50?4:05 | 4. Other useful features

**On screen:** Open the prepared Wi-Fi image and extracted text. Search wifi, then a rehearsed meaning-based query. In Ask AI, ask How many books can I borrow, and for how long? and open the actual library-policy PDF source. Bookmark an item, edit its heading and tags, and refresh. Show a real Retry processing action, or use Reprocess and name it accurately.

> Engram extracts useful text from images and PDFs, creates summaries and tags, and keeps the original files available. This makes information inside a screenshot searchable.
>
> Search combines keyword matches with semantic similarity, so I can look for exact words or a related meaning. I can narrow the results using filters.
>
> Ask AI answers questions using retrieved saved items and shows source cards. Here, I can open the library-policy document and check the answer against the original. Generated answers still need that source check.
>
> I can bookmark useful items and edit their headings, categories and tags. My corrections are stored separately, so reprocessing preserves them.
>
> Processing happens in the background with visible status labels. Failed work can be retried after its cause is fixed. Each account has its own library, and the backend checks ownership when accessing saved content.

## 4:05?4:30 | 5. Conclusion

**On screen:** Briefly show the README architecture diagram, then return to the dashboard.

> Engram combines a React interface, an Express backend, MongoDB, AI processing and private media storage. The aim is to make saved information useful again, with organization, search and answers linked to original sources.
>
> The current prototype demonstrates the workflow, while the official WhatsApp integration is the next deployment step. Save in a moment. Find when it matters. Thank you.

## Recording notes

- Show actual results and original sources. If a new item is still processing, identify any completed example as prepared earlier.
- Record saved-date filters and event dates as distinct concepts. The reminders panel covers seven days; the Upcoming section can include later future events.
- Keep passwords, linked-device codes and personal documents out of the recording. Use synthetic material for Confidential.
- Narration describes a general retry capability. Show Retry processing only on a real failed item; otherwise show Reprocess and call it reprocessing.
- Upload the finished video, check evaluator access in a private window, and add its actual URL to the README and submission form.

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
