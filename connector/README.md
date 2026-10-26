# Engram local WhatsApp connector

This optional, unofficial connector was requested on 26 Oct 2026 after Meta account restrictions blocked the Cloud API path. It runs on your own computer and captures **new messages sent to your own Message Yourself chat**. Other chats, groups, calls, audio, stickers and view-once media are ignored. There is no automatic reply or outgoing-message feature.

The student approved installation on 26 Oct 2026. The maintainers' `baileys@7.0.0-rc14` package is installed and pinned exactly in `package.json` and `package-lock.json`. This is a release candidate. Install from the lockfile with `npm ci` on another machine; do not install a lookalike package or an unreviewed fork.

## Dashboard installation (Windows x64)

Open Engram's WhatsApp connection window → **Personal connector → Set up on this computer**. Download and open `EngramConnectorSetup.exe`, finish installation, then return and click **Open connector**. Allow the browser's application prompt. Confirm the displayed server, sign in, and follow the phone-pairing instructions. Keep the terminal open and computer awake. Use the dashboard button to restart after closing it.

The installer includes Node and dependencies; users need neither npm nor administrator access. It installs under `%LOCALAPPDATA%\EngramConnector` and registers `engram://connect?server=...` for the current Windows account. This prototype installer is unsigned. The website cannot detect installation or connection state. Installation does not automatically pair WhatsApp.

### Build and publish (maintainer)

On Windows x64 with Node 24+, installed connector dependencies and the Windows .NET Framework compiler, run `npm run build:windows` in `connector/`. No additional packaging dependency is needed. Only source, installed dependencies, Node, its license and the launcher are bundled; local sessions and outbox data are excluded. The build prints a SHA-256 checksum.

Publish `connector/dist/EngramConnectorSetup.exe` alongside `server/`, keeping the same relative path on the deployed server. This Git-ignored binary must be included as a deployment artifact. The authenticated download endpoint returns 503 if it is absent. Keep it outside `server/public/`, which Vite clears. Rebuild after connector changes. macOS/Linux retain manual setup.

The launcher prevents duplicate instances, passes the URL without a command shell and validates it again in Node. Because any website can open a registered protocol, users confirm the destination before entering credentials.

To remove: close the terminal, revoke the device in WhatsApp's Linked devices, remove `HKEY_CURRENT_USER\Software\Classes\engram` in Registry Editor, then delete `%LOCALAPPDATA%\EngramConnector`. That folder holds private credentials and queued uploads. Reinstalling preserves them; deleting it removes queued content.

Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File windows/verify.ps1` from `connector/` to inspect the actual installer resource and run a bundled-runtime import check without installing or pairing. It extracts only the public package into a fresh `.cache/connector-smoke-*` directory. This does not verify the browser prompt, Windows registration, or live WhatsApp pairing.

## Manual setup / other operating systems

1. Use Node.js 24 and a running Engram server containing `/api/connectors/capture`. The updated backend must be deployed before using a hosted URL.
2. Create/sign in to your Engram account normally. Confirm Quick Add works.
3. With the dependency installed in this folder, run:

   ```text
   cd connector
   npm start
   ```

4. Enter the Engram base URL (`http://localhost:8000` locally or your HTTPS hosted URL), your Engram email and password. Password entry is hidden and credentials are not written to a file. The returned session cookie stays in memory.
5. Enter **your own WhatsApp number** with country code. A leading `+`, spaces, parentheses and hyphens are accepted and normalized automatically. Do not enter Meta's supplied test business number.
6. On your phone, open **WhatsApp → Linked devices → Link a device → Link with phone number** (wording may vary) and enter the pairing code displayed in your own terminal. Do not send that code to anyone or paste it into this chat.
7. Wait for “WhatsApp connected”. Send a **new** note/link/image/PDF to your Message Yourself chat, then use **Refresh timeline** in Engram.

## What is verified

All 7 parser/outbox tests and 30 backend tests pass. They establish self-chat filtering, supported content types, timestamps, media size limits, retry persistence, duplicate handling, HTTPS enforcement, JWT ownership and idempotent item/job capture. The installed Baileys exports also passed an import check. These checks do not establish successful live WhatsApp pairing. No personal WhatsApp account has been paired by the assistant.

## Operation and limitations

- Keep this local process running while capturing. It does not run on Render and does not need Meta webhooks or business-account approval.
- Only new `notify` events are captured. Old chats/history are not imported, and messages sent while disconnected might not be replayed. Use chat export for a historical archive.
- JPEG, PNG, WebP and PDF are accepted up to 10 MB. The same storage/enrichment pipeline is used; missing Supabase or AI access remains a separate dependency issue.
- A durable local outbox retries temporary HTTP failures; it is limited to 100 files / 100 MB. Rejected files remain with `.failed` suffix so they do not block later uploads. Capture/download/queue failures are announced without logging content; save those items manually if needed.
- Engram sign-in expires after the server's cookie lifetime; restart and sign in again. The outbox and WhatsApp session are isolated by the verified Engram user ID.
- Press Ctrl+C to stop. Stopping preserves the session and queued uploads. To revoke access, use **WhatsApp → Linked devices** on your phone and log this device out. If it is logged out, move its `.engram-session/<userId>` folder aside locally before pairing again; never share or commit that folder.
- `.engram-session/` contains linked-device credentials; `.engram-outbox/` contains captured private content, including queued media. Both are ignored by Git. Keep them on a trusted computer and out of shared folders. The library's multi-file auth helper is used for this single-user local prototype, not a public multi-user pairing service.
- WhatsApp can disconnect or restrict unofficial clients. Session storage and compatibility need maintenance; this connector is not officially supported by Meta.

## Checks

```text
cd connector
npm test
cd ../server
npm test
```

Source references: [Baileys repository](https://github.com/WhiskeySockets/Baileys), [maintainer connection example](https://github.com/WhiskeySockets/Baileys/blob/master/Example/example.ts). Do not copy the example's verbose provider logging; it can include private content.
