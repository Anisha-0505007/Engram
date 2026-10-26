# Desktop UI verification

Open http://localhost:8000 after building `client/`. Hosted changes require deployment.

1. Sign in or register. Confirm the sage wallpaper and centered auth window, and refresh the protected dashboard.
2. Single-click a desktop folder to select it; double-click or press Enter to open it. Dock icons open with one click. On a phone, tap a Home folder.
3. Open two sections. Click to focus, drag a title bar, move it using arrow keys (Shift for larger steps), minimize, restore and resize. Reload and confirm the last section and window geometry return.
4. Press `/` outside a text field to focus Spotlight. Search by topic; results replace the focused ordinary library window. Use Back to return to browsing. Search always excludes Confidential.
5. Open each filter popover. Check type, category, and original saved-date range in IST. Processing status only affects timeline browsing, not search/Ask.
6. Use Ask AI. Verify answer and source columns, stacked on mobile. Open a source and confirm the original saved item is displayed. Ask about absent content and expect the not-found response.
7. Use a card's primary Open link/View file action and More actions menu. Expand extracted text, edit tags/category, retry/reprocess, and delete with the stored-media confirmation. A protected/deleted source must disappear from open ordinary results and invalidate an existing answer.
8. Open Confidential while locked. Confirm there are no private titles/previews. Try a wrong password, unlock, use its local exact-text search, then lock. Verify the five-minute countdown and automatic expiry, including returning to the tab after inactivity. Reload starts locked.
9. Confirm classification runs automatically; unresolved scans remain hidden and offer Retry automatic classification. No manual privacy-review step is needed.
10. Check due-within-24-hours reminders, urgent styling within an hour, Dismiss, View Upcoming and the dock count. Refresh/focus must update reminders. There are no push/email/WhatsApp reminders.
11. Open Connect. Business status reflects phone linking only. Personal connector says Status unavailable, with local setup steps; never claim the website can pair or confirm the local process.
12. Check initial skeletons, empty guidance, inline errors with retry, success toasts, and refreshing without clearing existing cards. Try a slow connection.
13. At 390px and 768px widths, check Home, bottom tabs, sheets, filters, reminders and scrolling. Confirm no horizontal overflow, and keep all controls keyboard reachable with visible focus.
14. Switch accounts and inspect layout separation. LocalStorage may contain section names and numeric window geometry only, never saved items, answers, private queries, passwords or unlock state.
15. Sign out through Account. Repeat the main capture/search path on the deployed URL before claiming deployment works.

Automated checks used isolated synthetic browser responses; they do not validate live account/provider content. The backend regression suite continues to verify authorization and existing API behavior.
