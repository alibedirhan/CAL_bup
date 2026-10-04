import type { Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
/** Üretim adresi, yerel derleme. Tarayıcı gerçek siteye veya POS'a gitmez. */
export async function programiYereldenSun(r: Route) {
  const u = new URL(r.request().url());
  if (
    u.origin !== 'https://alibedirhan.github.io' ||
    !u.pathname.startsWith('/CAL_bup/') ||
    r.request().method() !== 'GET'
  )
    return r.abort();
  const rel = u.pathname.slice('/CAL_bup/'.length) || 'index.html';
  if (rel.includes('..')) return r.abort();
  const tur: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
    '.gz': 'application/octet-stream',
    '.html': 'text/html; charset=utf-8',
  };
  await r.fulfill({
    body: await readFile(resolve('dist', rel)),
    contentType: tur[extname(rel)] ?? 'application/octet-stream',
  });
}
