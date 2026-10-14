/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle deps of lazy routes too; otherwise the dev server re-optimizes on first visit and
  // reloads with a second React copy ("destroy is not a function").
  optimizeDeps: { entries: ['index.html', 'src/**/*.tsx'] },
  server: {
    port: 5173,
    // Same-origin proxy in development so HttpOnly cookies work without cross-site settings.
    proxy: { '/api': { target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000', changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:4000', changeOrigin: false } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('qr-scanner')) return 'qr-scanner';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
