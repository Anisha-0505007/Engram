import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// MongoDB test journals must not depend on free space on the Windows system drive.
const temporary = fileURLToPath(new URL('../../.cache/test-tmp/', import.meta.url));
await mkdir(temporary, { recursive: true });
const testDirectory = new URL('../tests/', import.meta.url);
const tests = (await readdir(testDirectory)).filter(name => name.endsWith('.test.js'))
  .map(name => fileURLToPath(new URL(name, testDirectory)));
const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...tests], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary },
});
child.once('error', () => { console.error('Could not start the test runner.'); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
