import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the API is proxied so the browser sees one origin (no CORS setup needed).
// In production set VITE_API_URL to the API origin and add the web origin to the API's CORS_ORIGINS.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/v1': { target: process.env.API_PROXY ?? 'http://localhost:3000', changeOrigin: true } } },
});
