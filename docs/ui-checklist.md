# Hosted release and UI checklist

Use https://engram-beryl.vercel.app. For local development use http://localhost:5173 with Express running at port 8000. These are manual acceptance checks, not a record of checks already passed.

1. Register a fresh account, dismiss/finish the tour, and confirm Connect opens below the main heading rather than covering it. Sign out and sign in again: section windows should start closed.
2. Refresh the authenticated dashboard. Confirm the session persists and browser API calls use the same frontend origin under /api.
3. Save an ordinary, non-confidential note. Observe pending/processing and require a real done result before declaring AI processing available. Retry any stored failure after its cause is fixed.
4. Open folders, dock icons and keyboard controls. Opening another section should close the previous section. Check movement, resize/minimize/restore and keyboard focus without expecting an old section to reopen after a new login.
5. Inspect the time-based wallpaper, visible headings, individual window themes and readable status/urgency colors. Confirm theme controls do not affect the ability to read forms or errors.
6. Upload harmless JPEG/PNG/WebP and PDF fixtures. Confirm size/type validation, classification progress, extracted content and authorized media viewing. Failed/unresolved privacy scans must not expose content in ordinary lists.
7. Check All items, Links, Photos, Upcoming and Bookmarks. Bookmark and unbookmark a completed ordinary item; refresh to confirm persistence. Check bookmark state on search result cards too.
8. Edit a heading, category and tags. Confirm original content remains unchanged, the new heading persists, and reprocessing keeps the manual overrides.
9. Try a known keyword match and a meaningful semantic match. Inspect any Atlas/provider fallback warnings. Search must exclude Confidential; do not interpret a warning/fallback as proof that semantic search succeeded.
10. Use Ask with a question whose answer exists in saved content. Open the sources and verify support. A genuinely absent query should give an honest not-found result; invalid citations must not be presented as a confident sourced answer.
11. Check original saved-date/type/category filters and pagination. Saved date is distinct from an event deadline. Confirm reversed date ranges show a useful validation message.
12. Open Confidential while locked: no private previews. Try a wrong password, unlock using the account password, then lock/let the five-minute session expire. Check ordinary search and Ask remain private-content-free.
13. With a real future event fixture, inspect Upcoming and in-app reminders. Reminders appear within 24 hours and become urgent within one hour; dismiss/view actions should work. No push/email/WhatsApp reminder delivery is promised.
14. Delete a throwaway item. Confirm it disappears after refresh and file cleanup failure is shown honestly. A processing item can require retrying deletion after completion.
15. In separate browser profiles, confirm two accounts have distinct libraries; sign out and verify protected pages require login. Do not store passwords, saved messages, answers or unlock state in browser localStorage.
16. Check initial loading, empty libraries, invalid inputs, API errors, retry feedback and success messages. Try one slow/network-failure condition without changing shared production credentials.
17. At mobile widths such as 390px and 768px, check navigation, dialogs, scrolling, visible focus and no horizontal overflow.
18. Treat WhatsApp as optional until verified. Business linking is not proof of delivery. Personal connector launch is not proof of installation or pairing. The installer is a separate release artifact and the browser cannot confirm the local process is connected.
19. Record the full fresh-account capture-to-search path on the hosted release before claiming readiness. Add the real video link and complete the official submission form.

Record results in [submission-audit.md](submission-audit.md). Automated in-memory tests and anonymous health checks do not replace an authenticated hosted walkthrough.
