import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
const embedHeaders = {
  'Content-Security-Policy': 'frame-ancestors *',
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    headers: embedHeaders,
  },
  preview: {
    headers: embedHeaders,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
