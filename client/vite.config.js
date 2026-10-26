import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api/* requests to the backend during development.
// This avoids CORS issues locally — the browser thinks everything
// is on the same origin (localhost:5173).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
