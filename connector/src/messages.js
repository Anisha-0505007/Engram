const normalizeJid = value => typeof value === 'string'
  ? value.replace(/:\d+(?=@)/, '').replace(/@c\.us$/, '@s.whatsapp.net') : '';

export function parseSelfMessage(message, selfIds) {
  const identities = new Set(selfIds.filter(Boolean).map(normalizeJid));
  const key = message?.key;
  if (!key?.fromMe || !key.id || !identities.size) return null;
  const peers = [key.remoteJid, key.remoteJidAlt].filter(Boolean).map(normalizeJid);
  if (!peers.some(peer => identities.has(peer))) return null;
  let content = message.message;
  // Ordinary ephemeral messages are supported; view-once content is deliberately ignored.
  for (let i = 0; i < 3; i++) {
    if (content?.ephemeralMessage?.message) content = content.ephemeralMessage.message;
    else if (content?.documentWithCaptionMessage?.message) content = content.documentWithCaptionMessage.message;
    else break;
  }
  if (!content || content.viewOnceMessage || content.viewOnceMessageV2 || content.viewOnceMessageV2Extension) return null;
  const seconds = Number(message.messageTimestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  const common = { messageId: key.id, timestamp: date.toISOString() };
  const media = content.imageMessage || content.documentMessage;
  if (media) {
    const mime = media.mimetype || '';
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime)) return null;
    if (Number(media.fileLength || 0) > 10 * 1024 * 1024) return null;
    return { ...common, text: (media.caption || '').slice(0, 20000), type: mime === 'application/pdf' ? 'pdf' : 'image', mime };
  }
  const text = content.conversation || content.extendedTextMessage?.text;
  if (typeof text !== 'string' || !text.trim()) return null;
  return { ...common, text: text.slice(0, 20000), type: /https?:\/\/[^\s]+/.test(text) ? 'link' : 'text' };
}

export async function readMedia(stream, limit = 10 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) throw new Error('File exceeds the 10 MB limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
