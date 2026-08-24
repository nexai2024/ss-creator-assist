import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
const embedHeaders = {
  'Content-Security-Policy': 'frame-ancestors *',
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'SS Creator Assist',
        short_name: 'CreatorAssist',
        description: 'Helpdesk and ticketing solution for solopreneurs',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
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
