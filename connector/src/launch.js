import { normalizeServerUrl } from './api.js';

export function serverFromLaunchLink(value) {
  const link = new URL(value);
  if (link.protocol !== 'engram:' || link.hostname !== 'connect' ||
      !['', '/'].includes(link.pathname) || link.username || link.password || link.port || link.hash ||
      [...link.searchParams.keys()].some(key => key !== 'server') ||
      link.searchParams.getAll('server').length !== 1) {
    throw new Error('Invalid connector launch link. Open the connector from your Engram dashboard.');
  }
  return normalizeServerUrl(link.searchParams.get('server'));
}
