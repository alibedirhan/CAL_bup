import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ana from './playwright.config';

export default defineConfig(ana, {
  testDir: './tests/performans',
  outputDir: join(tmpdir(), 'cal-bup-playwright-performans'),
  timeout: 180_000,
});
