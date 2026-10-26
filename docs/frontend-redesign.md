# Engram desktop frontend

## Scope
Frontend presentation and interaction only. Existing routes, auth cookies, data models, classification, retrieval, storage and worker behavior are unchanged. The removed manual capture form stays removed. WhatsApp is the visible capture path.

## Implementation
- `client/src/pages/Dashboard.jsx`: desktop shell, account lifecycle, global search state, five-minute unlock lifecycle, menus, folders and dock.
- `client/src/desktop/DesktopWindow.jsx` and `useDesktopWindows.js`: drag/keyboard movement, focus ordering, minimize/resize/close, viewport bounds and per-account layout persistence.
- `LibraryWindow.jsx` and `useLibrary.js`: independent section loading, original-date filters, cursor pagination and non-overlapping refresh.
- `SavedItemCard.jsx` and `ItemDialog.jsx`: compact cards, event strips, media access, progressive disclosure, editing, deletion and protection actions.
- `Spotlight.jsx`: Search/Ask modes and filter popovers. `AuxiliaryWindows.jsx`: answers/sources, account, help and separate connector setup flows.
- `Activity.jsx` and `useActivity.js`: reminder notifications and classification counts, refreshing every 30 seconds and on focus.
- `client/src/index.css`: sage/slate wallpaper, warm windows, responsive mobile layout, focus/reduced-motion styles and shared auth appearance.
- `client/public/fonts/`: official Inter variable font served locally with its SIL Open Font License. No package dependency added.

## Assumptions
1. No reference image/link was attached; the written visual specification governs the design.
2. Global Spotlight searches the whole non-confidential library, regardless of the focused section. Search replaces an ordinary library window's content; Ask opens its own window.
3. The local connector has no backend heartbeat endpoint. Its status is explicitly unavailable, not guessed as Running/Not running. A linked business phone is not a health check.
4. Reload restores layout/last section but always starts Confidential locked. The server remains the authority; the UI also checks vault state on focus.
5. Source detail uses the item data already returned by retrieval; no item-detail API was invented.
6. Layout storage is scoped by account ID. Only section names and numeric geometry/resize preference are persisted; content, queries and unlock state stay in memory.
7. Dates labelled Saved refer to the original message timestamp in IST; event dates are labelled separately. Photos and Upcoming reuse backend section filters.

## Verification
- Production Vite build succeeds.
- Existing backend regression: 40 passed, 2 opt-in provider simulations skipped; no backend edits were made for this redesign.
- Isolated Chrome desktop/mobile checks passed search, Ask/source opening, editing/deletion API contracts, keyboard movement, incorrect-password feedback, unlock/expiry/lock, last-section restoration and localStorage privacy.
- A 6.5-second-response browser check passed initial loading and manual refresh, with existing cards retained and no overlapping polling requests.
- Screenshots inspected at desktop and 390px mobile widths, including auth. Representative text/button/status color pairs exceed 4.5:1; reduced-motion overrides and visible focus rules are present.
- Synthetic browser fixtures live only in ignored `.cache/`, not production routes.

## Handoff
Refresh the local app with Ctrl+Shift+R. No deployment was performed. Real WhatsApp/provider behavior still depends on the existing configured services. Follow `docs/ui-checklist.md` for final live-account and deployment checks.

Remaining account-credit percentage is not exposed to this coding session; no automatic 5% threshold can be observed. This document is the durable implementation summary if work is interrupted.
