import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Yayındaki sayfa kendi dosyaları dışında hiçbir yere bağlanamaz.
// Google Drive aşamasında yalnızca Google adresleri eklenecek.
const GUVENLIK_POLITIKASI = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function guvenlikPolitikasi(): Plugin {
  return {
    name: 'bup-guvenlik-politikasi',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: GUVENLIK_POLITIKASI },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  base: '/Bup_Excel_Rapor/',
  plugins: [react(), guvenlikPolitikasi()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
