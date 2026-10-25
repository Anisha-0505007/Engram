import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api/* requests to the backend during development.
// This avoids CORS issues locally — the browser thinks everything
// is on the same origin (localhost:5173).
export default defineConfig({
  plugins: [react()],
  build: {
    // Build directly into server/public so Express can serve the SPA
    outDir: '../server/public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
