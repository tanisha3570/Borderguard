import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Proxies /api and /uploads to the Express server (server/server.js, port 3000)
// so the frontend can call fetch('/api/...') without hardcoding a host,
// and so <img src="/uploads/..."> resolves to the backend's stored files.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/public/tesseract/**', '**/public/models/**', '**/server/uploads/**', '**/server/*.db*'],
    },
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/uploads': 'http://127.0.0.1:3000',
    },
  },
});
