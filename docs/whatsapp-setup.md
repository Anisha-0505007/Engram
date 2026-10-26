# Connect the WhatsApp bot

## Meta app
Open https://developers.facebook.com/apps/ and open your app. If you do not have one, create an app with the WhatsApp business-messaging use case/product, following the options shown in your current dashboard. Use Meta's supplied test business number for the project.

In WhatsApp → API Setup (or Getting Started), add and verify your own phone as a test recipient. Note the business **Phone number ID**, which is different from its displayed phone number and the WhatsApp Business Account ID (WABA ID).

Generate an access token in the dashboard. Tokens expire; check the expiry shown there and refresh it before the demo if needed. See [Meta's official Postman collection](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api) for permissions and token types.

## Server configuration
Enter these values yourself in `server/.env` for local testing or in your hosting provider's environment settings for deployment. Never paste secrets in chat or commit them:

```text
WHATSAPP_APP_SECRET=<Meta app settings → Basic → App secret>
WHATSAPP_VERIFY_TOKEN=<a random verification string you choose>
WHATSAPP_ACCESS_TOKEN=<the token generated for this app>
WHATSAPP_PHONE_NUMBER_ID=<the business phone number ID>
WHATSAPP_API_VERSION=<the Graph version supported by your app>
```

Restart the server after changing environment values. Supabase is required for saved images/PDFs; Gemini access is required for enrichment, not basic text capture or acknowledgements.

## Public webhook
Meta cannot call `localhost`. Use the deployed server with the current code, or a forwarding endpoint for the local server. Do not register a hosted URL until its actual route has been verified.

Callback URL: `https://YOUR_PUBLIC_HOST/webhook/whatsapp`

In WhatsApp → Configuration, edit the webhook, enter that callback and the **same** verify token as the server, and verify/save. Subscribe to the `messages` field. Ensure the app is subscribed to the correct WABA; the official Graph endpoint is `POST /{version}/{WABA-ID}/subscribed_apps`. Do not substitute the phone number ID here. Follow any test/development/live-mode restrictions shown by Meta; a successful GET handshake alone does not prove inbound delivery.

For local forwarding with Postman, sign in first with `postman login`; then create/reuse a webhook and forward it to port 8000. Use the printed public base URL plus `/webhook/whatsapp`. Postman records forwarded requests, so use synthetic test content while setting up.

## Check and link
From `server/`, run `node scripts/whatsappDoctor.mjs`. It prints only configuration presence and probe results. `--check-meta` also performs a read-only phone-ID lookup. Set `WHATSAPP_CHECK_URL` in the invoking shell to check a public server instead of localhost; no environment file needs to be read by the assistant.

1. Sign in to Engram, click **Get Link Code**, and send that 6-digit code to Meta's test business number from your whitelisted phone.
2. Wait for “WhatsApp linked ✅” and the linked status in the UI.
3. Send `Engram bot test note`. Expect one timeline item and “Saved ✅”. Sending the same text twice normally creates two distinct WhatsApp messages; idempotency means repeated delivery of the same message ID is ignored.
4. Send a small image/PDF after storage is configured. Watch pending/processing/done or a clear failure state.

If GET verification fails, check callback reachability and the verify token. If nothing arrives, check the messages field, WABA subscription, test recipient and dashboard mode restrictions. If capture works but replies fail, check access-token expiry, phone ID, messaging permissions and the customer-service reply window.
