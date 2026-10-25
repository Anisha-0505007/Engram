import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a single supabase client for interacting with your database/storage
let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const BUCKET_NAME = 'engram-media';

/**
 * Uploads a file buffer to Supabase Storage.
 * @param {Buffer} buffer - The file buffer to upload
 * @param {string} filename - The name of the file (e.g. '12345.jpg')
 * @param {string} contentType - The MIME type (e.g. 'image/jpeg')
 * @returns {Promise<string>} The storage key (path) of the uploaded file
 */
export const uploadFile = async (buffer, filename, contentType) => {
  if (!supabase) throw new Error('Supabase client not initialized. Check your .env');

  // We place files in a folder structure: userId/filename or just flat. Let's do flat for now with unique names.
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filename, buffer, {
      contentType: contentType,
      upsert: true, // Overwrite if it exists
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error('Failed to upload file to Supabase');
  }

  return data.path; // This is the storageKey we save in MongoDB
};

/**
 * Generates a short-lived (1 hour) authenticated URL to view the file.
 * We use this so our bucket can remain private!
 * @param {string} storageKey - The path of the file in the bucket
 * @returns {Promise<string>} The temporary URL
 */
export const getPresignedUrl = async (storageKey) => {
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storageKey, 3600); // 3600 seconds = 1 hour

  if (error) {
    console.error('Supabase signed URL error:', error);
    return null;
  }

  return data.signedUrl;
};
