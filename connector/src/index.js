import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { prompt } from './prompt.js';
import { normalizeServerUrl, loginToEngram, uploadFailureMessage } from './api.js';
import { parseSelfMessage, readMedia } from './messages.js';
import { createOutbox } from './outbox.js';
import { normalizePhoneNumber } from './phone.js';
import { serverFromLaunchLink } from './launch.js';

if (process.argv[2]) {
  // Leave errors visible in a browser-launched console until the user dismisses it.
  process.once('beforeExit', async () => {
    if (process.stdin.isTTY) await prompt('Connector stopped. Press Enter to close this window. ');
  });
}

async function main() {
  let library;
  try { library = await import('baileys'); }
  catch { throw new Error('Baileys is not installed. Install the approved dependency in connector/ first.'); }
  const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion, DisconnectReason, downloadMediaMessage } = library;
  const launchLink = process.argv[2];
  const base = launchLink ? serverFromLaunchLink(launchLink)
    : normalizeServerUrl(await prompt('Engram URL [http://localhost:8000]: ') || 'http://localhost:8000');
  console.log(`\nENGRAM PERSONAL CONNECTOR\nSigning in to: ${base}\n`);
  // A custom protocol can be opened by any website, so confirm the destination before credentials.
  if (launchLink && (await prompt('Is this your Engram website? Type yes to continue: ')).toLowerCase() !== 'yes') {
    throw new Error('Cancelled');
  }
  const email = await prompt('Engram email: ');
  let password = await prompt('Engram password (hidden): ', { secret: true });
  const api = await loginToEngram(base, email, password);
  password = '';
  const root = fileURLToPath(new URL('../', import.meta.url));
  const outbox = await createOutbox(join(root, '.engram-outbox', api.userId));
  const { state, saveCreds } = await useMultiFileAuthState(join(root, '.engram-session', api.userId));
  const phone = state.creds.registered ? '' : normalizePhoneNumber(await prompt('Your WhatsApp number with country code: '));
  console.log('Signed in to Engram. Only messages sent to your own Message Yourself chat will be captured.');
  // Disable provider logging because it can include content and session material.
  const logger = { level: 'silent', child() { return this; }, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };
  const { version } = await fetchLatestBaileysVersion();
  let stopped = false;
  let socket;
  let reconnect;
  let flushTimer;
  let reconnectAttempts = 0;
  let saveChain = Promise.resolve();
  let captureChain = Promise.resolve();
  let pendingCaptures = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true; clearTimeout(reconnect); clearTimeout(flushTimer);
    socket?.end(new Error('Connector stopped by user'));
    console.log('Connector stopped. Pending uploads remain in the private local queue.');
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);

  const flush = async () => {
    if (stopped) return;
    let delay = 2000;
    try {
      const result = await outbox.flushOne(api.send);
      if (result === true) console.log('Saved one self-chat item to Engram.');
      if (result === 'rejected') console.warn('An upload was rejected. It remains in a .failed queue file; use Quick Add to save it manually.');
    } catch (error) {
      if (error.status === 401) { console.warn('Engram session expired. Restart this connector and sign in again.'); stop(); return; }
      delay = (error.retryAfter || 30) * 1000;
      console.warn(uploadFailureMessage(error));
    }
    if (!stopped) flushTimer = setTimeout(flush, delay);
  };

  const connect = () => {
    if (stopped) return;
    const current = makeWASocket({ version, logger,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
      generateHighQualityLinkPreview: false, connectTimeoutMs: 30000,
      getMessage: async () => undefined,
    });
    socket = current;
    let pairingRequested = false;
    current.ev.on('creds.update', () => {
      saveChain = saveChain.then(saveCreds).catch(() => { console.warn('Could not save the linked-device session. Check local disk space.'); stop(); });
    });
    current.ev.on('connection.update', async update => {
      if (stopped || current !== socket) return;
      if (update.qr && !state.creds.registered && !pairingRequested) {
        pairingRequested = true;
        try {
          const code = await current.requestPairingCode(phone);
          console.log('On your phone: WhatsApp → Linked devices → Link a device → Link with phone number.');
          // Pairing material is displayed only in the user's interactive terminal, never a server log.
          console.log(`Enter this pairing code on your phone: ${code}`);
        } catch { console.warn('Pairing could not start. Restart the connector and try again.'); stop(); }
      }
      if (update.connection === 'open') { reconnectAttempts = 0; console.log('WhatsApp connected. Send a NEW note/link/image/PDF to your Message Yourself chat.'); }
      if (update.connection === 'close') {
        if (update.lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
          console.warn('WhatsApp logged this linked device out. See connector/README.md to pair again.'); stop(); return;
        }
        if (++reconnectAttempts > 8) { console.warn('WhatsApp reconnect limit reached. Restart the connector later.'); stop(); return; }
        console.log('WhatsApp disconnected. Reconnecting…');
        reconnect = setTimeout(connect, Math.min(1000 * 2 ** reconnectAttempts, 30000));
      }
    });
    current.ev.on('messages.upsert', event => {
      if (stopped || current !== socket || event.type !== 'notify') return;
      for (const message of event.messages) {
        const input = parseSelfMessage(message, [current.user?.id, current.user?.lid]);
        if (!input) continue;
        if (pendingCaptures >= 100) { console.warn('Capture queue is busy. This new item was not captured; save it with Quick Add.'); continue; }
        pendingCaptures++;
        captureChain = captureChain.then(async () => {
          const { mime, ...payload } = input;
          if (mime) {
            const stream = await downloadMediaMessage(message, 'stream', { options: { signal: AbortSignal.timeout(20000) } }, { logger, reuploadRequest: current.updateMediaMessage });
            const buffer = await readMedia(stream);
            payload.media = { mime, data: buffer.toString('base64') };
          }
          await outbox.add(payload);
        }).catch(() => console.warn('A self-chat item could not be queued. It was not saved; retry it or use Quick Add.'))
          .finally(() => { pendingCaptures--; });
      }
    });
  };
  connect(); flush();
}

main().catch(error => {
  const safe = /^(Baileys is not installed|Use an HTTPS|Engram sign-in failed|Engram did not|Could not verify|Run the connector|Enter your own|Cancelled)/.test(error.message || '');
  console.error(safe ? error.message : 'Connector could not start. Check connectivity, local disk space and connector/README.md.');
  process.exitCode = 1;
});
