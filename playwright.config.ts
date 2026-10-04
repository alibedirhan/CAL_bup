import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './tests/tarayici',
  outputDir: join(tmpdir(), 'cal-bup-playwright'),
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4180',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    // Route taklidi unutulsa da POS/Google dahil dış ağa çıkılamaz.
    proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' },
    launchOptions: { args: ['--disable-background-networking'] },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180/CAL_bup/',
    reuseExistingServer: !process.env.CI,
  },
});
