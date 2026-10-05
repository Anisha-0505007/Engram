import axios from 'axios';

/**
 * api — a pre-configured axios instance.
 * withCredentials: true tells the browser to send cookies on every request
 * even when the dev proxy is in use. Without this, the auth cookie would be
 * silently dropped and every /api/auth/me call would return 401.
 */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export default api;
