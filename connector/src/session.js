import { access, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function accountSessionPath(root, userId) {
  // The verified account ID must remain a directory name, never a supplied path.
  if (!/^[a-f\d]{24}$/i.test(userId)) throw new Error('Invalid connector account identity.');
  return join(root, '.engram-session', userId);
}

export async function hasSavedSession(root, userId) {
  try { await access(accountSessionPath(root, userId)); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function archiveSession(root, userId) {
  const source = accountSessionPath(root, userId);
  const backups = join(root, '.engram-session-backups', userId);
  await mkdir(backups, { recursive: true });
  // Move the whole directory without reading credentials; queued captures live elsewhere.
  const destination = join(backups, randomUUID());
  try { await rename(source, destination); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  return true;
}
