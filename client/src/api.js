import axios from 'axios';

/**
 * api — a pre-configured axios instance.
 * withCredentials: true tells the browser to send cookies on every request
 * even when the dev proxy is in use. Without this, the auth cookie would be
 * silently dropped and every /api/auth/me call would return 401.
 */
const api = axios.create({
  // Vercel serves the UI while Render hosts the API in production.
  // Local development keeps using Vite's same-origin /api proxy.
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
});

export default api;
