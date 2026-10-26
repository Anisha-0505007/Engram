import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { stat } from 'node:fs/promises';
import routes from '../src/routes/connector.routes.js';

test('installer requires login and returns a binary or an explicit unavailable error', async () => {
  process.env.JWT_SECRET = 'download-test-only-secret';
  const app = express();
  app.use(cookieParser());
  app.use('/api/connectors', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/connectors/download/windows`;
  try {
    assert.equal((await fetch(url)).status, 401);
    const token = jwt.sign({ userId: '0123456789abcdef01234567' }, process.env.JWT_SECRET);
    const response = await fetch(url, { headers: { Cookie: `token=${token}` } });
    const installer = await stat(new URL('../../connector/dist/EngramConnectorSetup.exe', import.meta.url)).catch(() => null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (installer) {
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-disposition'), /attachment; filename="EngramConnectorSetup.exe"/);
      assert.equal(Number(response.headers.get('content-length')), installer.size);
      const reader = response.body.getReader();
      const { value } = await reader.read();
      assert.equal(Buffer.from(value).subarray(0, 2).toString(), 'MZ');
      await reader.cancel();
    } else {
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /installer is not available/);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
