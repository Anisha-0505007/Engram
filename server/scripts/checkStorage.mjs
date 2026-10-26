import 'dotenv/config';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { uploadFile, getPresignedUrl, deleteFile } from '../src/services/storage.service.js';

const name = 'engram-media';
let uploadedKey;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Storage configuration is missing.');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let { data: bucket, error } = await client.storage.getBucket(name);
  if (error && Number(error.statusCode || error.status) === 404 && process.argv.includes('--create-bucket')) {
    const created = await client.storage.createBucket(name, { public: false, fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] });
    if (created.error) throw new Error('Private bucket creation failed. Check storage permissions.');
    console.log('Private engram-media bucket created.');
    ({ data: bucket, error } = await client.storage.getBucket(name));
  }
  if (error || !bucket) throw new Error('Storage bucket is unavailable. Check bucket name and server-key permissions.');
  if (bucket.public) throw new Error('Storage bucket is public. Make engram-media private before using it.');
  console.log('Private bucket: PASS');
  const fixture = Buffer.from('%PDF-1.4\n% Synthetic Engram storage verification\n%%EOF');
  const key = `verification/storage-${crypto.randomUUID()}.pdf`;
  await uploadFile(fixture, key, 'application/pdf'); uploadedKey = key;
  console.log('Upload: PASS');
  const signedUrl = await getPresignedUrl(key);
  if (!signedUrl) throw new Error('Signed link creation failed.');
  const response = await fetch(signedUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(fixture)) throw new Error('Signed download failed.');
  console.log('Signed download: PASS');
} catch (error) {
  const safe = /^(Storage |Private bucket |Media |Signed )/.test(error.message || '');
  console.error(safe ? error.message : 'Storage verification failed. Provider details and credentials hidden.');
  process.exitCode = 1;
} finally {
  if (uploadedKey) {
    try { await deleteFile(uploadedKey); console.log('Test file cleanup: PASS'); }
    catch { console.error('Test file cleanup failed; retry cleanup of the synthetic verification object.'); process.exitCode = 1; }
  }
}
