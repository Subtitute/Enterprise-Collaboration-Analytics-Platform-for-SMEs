import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite dev-server proxy mirrors the production Nginx reverse-proxy: the browser only ever
// talks to a single origin. All REST calls go to /api/v1/*, all WebSocket calls go to /ws/*,
// both forwarded here to the Gateway service (published on the host per infra/docker-compose.yml).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
