import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on your LAN IP too, not just localhost
    allowedHosts: true, // allow tunnel hostnames (trycloudflare.com, ngrok) during the hackathon
    // Everything goes through the web origin, so one URL (and one HTTPS tunnel) covers the whole app.
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        split: resolve(import.meta.dirname, 'split.html'),
      },
    },
  },
});
