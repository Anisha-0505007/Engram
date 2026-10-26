import { mkdir, readdir, stat, writeFile, rename, readFile, unlink, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';

export async function createOutbox(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let writing = Promise.resolve();
  return {
    async add(input) {
      // Serialize writes and bind this folder to the authenticated Engram user.
      const operation = writing.then(async () => {
        const filename = crypto.createHash('sha256').update(input.messageId).digest('hex') + '.json';
        const files = await readdir(directory);
        if (files.includes(filename)) return;
        const body = JSON.stringify(input);
        const bytes = await Promise.all(files.map(file => stat(join(directory, file)).then(info => info.size)));
        if (files.length >= 100 || bytes.reduce((a, b) => a + b, 0) + Buffer.byteLength(body) > 100 * 1024 * 1024) {
          throw new Error('Local capture queue is full. Resolve failed uploads before saving more messages.');
        }
        const target = join(directory, filename);
        await writeFile(target + '.tmp', body, { mode: 0o600 });
        await rename(target + '.tmp', target);
      });
      writing = operation.catch(() => {});
      return operation;
    },
    async flushOne(send) {
      const pending = (await readdir(directory)).filter(file => file.endsWith('.json'));
      const ordered = await Promise.all(pending.map(async file => ({ file, modified: (await stat(join(directory, file))).mtimeMs })));
      const filename = ordered.sort((a, b) => a.modified - b.modified || a.file.localeCompare(b.file))[0]?.file;
      if (!filename) return false;
      const path = join(directory, filename);
      const item = JSON.parse(await readFile(path, 'utf8'));
      try { await send(item); }
      catch (error) {
        if ([400, 413, 422].includes(error.status)) {
          await rename(path, path + '.failed');
          return 'rejected';
        }
        // A storage failure on one image must not starve unrelated plain-text captures.
        const retryTime = new Date(Date.now() + (error.retryAfter || 30) * 1000);
        await utimes(path, retryTime, retryTime);
        throw error;
      }
      await unlink(path);
      return true;
    },
  };
}
