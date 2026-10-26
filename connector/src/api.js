export function normalizeServerUrl(input) {
  const url = new URL(input);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Use an HTTPS server URL, or http://localhost:8000 for local development.');
  }
  return url.origin;
}

export async function loginToEngram(base, email, password) {
  const request = (path, options = {}) => fetch(`${base}/api${path}`, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  const response = await request('/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error(`Engram sign-in failed (HTTP ${response.status}). Check your account and server URL.`);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Engram did not return a session cookie.');
  const identity = await request('/auth/me', { headers: { Cookie: cookie } });
  const user = await identity.json();
  if (!identity.ok || !/^[a-f\d]{24}$/i.test(user.userId || '')) throw new Error('Could not verify the Engram account.');
  return { userId: user.userId, async send(input) {
    const result = await request('/connectors/capture', { method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!result.ok) {
      const details = await result.json().catch(() => ({}));
      const error = new Error(`Engram capture returned HTTP ${result.status}.`);
      error.status = result.status;
      // Convert server details to a fixed category; never log raw response bodies.
      error.category = /^Media storage is not configured/.test(details.error || '') ? 'storage_missing'
        : /^Media upload failed/.test(details.error || '') ? 'storage_failed' : 'http';
      error.retryAfter = Math.min(300, Math.max(5, Number(result.headers.get('retry-after')) || 30));
      throw error;
    }
    return result.json();
  } };
}

export function uploadFailureMessage(error) {
  if (error.category === 'storage_missing') return 'Media upload is waiting: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the Engram server, then restart it. The file remains queued.';
  if (error.category === 'storage_failed') return 'Media upload failed: check the private engram-media bucket and storage permissions. The file remains queued.';
  if (error.status === 404) return 'Capture endpoint not found (HTTP 404). Start/deploy the updated Engram backend. The item remains queued.';
  if (error.status === 429) return 'Engram rate limit reached (HTTP 429). The queued item will retry after the wait period.';
  if (error.status) return `Engram upload failed (HTTP ${Number(error.status)}). The item remains queued and will retry.`;
  return 'Engram upload or local queue unavailable. Check server connectivity and local disk access; queued files have not been deleted.';
}
