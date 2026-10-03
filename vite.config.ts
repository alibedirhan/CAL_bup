import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Drive ve Google kimlik kitaplığı dışında dış bağlantıya izin verilmez.
const GUVENLIK_POLITIKASI = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com",
  "worker-src 'self' blob:",
  'frame-src https://accounts.google.com/gsi/',
  "object-src 'none'",
  "base-uri 'self'",
  'form-action https://denizpay.bupilic.com.tr/login.aspx',
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
  base: '/CAL_bup/',
  plugins: [react(), guvenlikPolitikasi()],
  // Excel motoru (ExcelJS, ~940 KB) bilerek ayrı ve büyük bir parçadır; ilk dosya açılınca yüklenir.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
