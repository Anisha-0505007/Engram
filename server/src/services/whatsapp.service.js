/**
 * Fetches a media file from WhatsApp Cloud API and returns it as a Buffer.
 * 
 * @param {string} mediaId - The ID of the media from the webhook payload
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
export const downloadWhatsAppMedia = async (mediaId) => {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('Missing WHATSAPP_ACCESS_TOKEN in .env');

  // Step 1: Ask Meta for the temporary download URL using the media ID
  const urlRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const urlData = await urlRes.json();

  if (urlData.error) {
    throw new Error(`Meta API Error: ${urlData.error.message}`);
  }

  const mediaUrl = urlData.url;
  const mimeType = urlData.mime_type;

  // Step 2: Download the actual binary file from the temporary URL
  const mediaRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!mediaRes.ok) {
    throw new Error(`Failed to download media buffer: ${mediaRes.statusText}`);
  }

  const arrayBuffer = await mediaRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, mimeType };
};
