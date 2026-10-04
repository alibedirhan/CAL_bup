import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
test('yayınlanan MV3 paketi yalnızca gerekli sitelere ve depolama/süre yetkisine sahiptir', async () => {
  const m = JSON.parse(await readFile('dist/pos-yardimcisi/manifest.json', 'utf8'));
  expect(m.manifest_version).toBe(3);
  expect(m.permissions).toEqual(['storage', 'alarms']);
  expect(m.host_permissions).toEqual(['https://denizpay.bupilic.com.tr/*']);
  expect(m.content_scripts.map((s: { matches: string[] }) => s.matches)).toEqual([
    ['https://alibedirhan.github.io/CAL_bup/*'],
    ['https://denizpay.bupilic.com.tr/*'],
  ]);
  expect(m.externally_connectable).toBeUndefined();
  expect(m.web_accessible_resources).toBeUndefined();
  expect(m.content_security_policy.extension_pages).toContain("connect-src 'none'");
  const z = await JSZip.loadAsync(await readFile('dist/pos-yardimcisi.zip'));
  expect(Object.keys(z.files).sort()).toEqual([
    'KURULUM.txt',
    'arkaPlan.js',
    'kopru.js',
    'manifest.json',
    'pos.js',
  ]);
  for (const [ad, f] of Object.entries(z.files))
    expect(await f.async('nodebuffer')).toEqual(await readFile('dist/pos-yardimcisi/' + ad));
});
