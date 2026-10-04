import { test, expect, type Page } from '@playwright/test';
async function ortam(page: Page, tur: 'rapor' | 'oturum') {
  let dis = 0;
  await page.context().route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.origin === 'http://127.0.0.1:4180') return r.continue();
    if (u.origin !== 'https://www.googleapis.com') {
      dis++;
      return r.abort();
    }
    const klasor = u.searchParams.get('q')?.includes("value='klasor'");
    return r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        files: klasor
          ? [
              {
                id: 'yapay-klasor',
                name: 'CAL bup',
                mimeType: 'application/vnd.google-apps.folder',
                createdTime: '2026-10-04T00:00:00Z',
                appProperties: { calbup: 'v1', tur: 'klasor' },
              },
            ]
          : Array.from({ length: 21 }, (_, i) => ({
              id: `yapay-${i}`,
              name: `Yapay rapor ${i + 1}.xlsx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              createdTime: '2026-10-04T00:00:00Z',
              appProperties: { calbup: 'v1', tur },
            })),
      }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('bup-rapor:drive-istemci', 'yapay.apps.googleusercontent.com');
    Reflect.set(globalThis, 'google', {
      accounts: {
        oauth2: {
          initTokenClient: (a: { callback: (v: unknown) => void }) => ({
            requestAccessToken: () =>
              a.callback({
                access_token: 'yapay-token',
                expires_in: 3600,
                scope: 'https://www.googleapis.com/auth/drive.file',
              }),
          }),
        },
      },
    });
  });
  await page.goto('/CAL_bup/#/ayarlar');
  await page.getByRole('button', { name: 'Drive’a bağlan', exact: true }).click();
  await expect(page.getByText('Bağlı', { exact: true })).toBeVisible();
  return () => dis;
}
test('Drive rapor listesinde yirminci kayıttan sonrakine erişilir', async ({ page }) => {
  const dis = await ortam(page, 'rapor');
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  await page.getByRole('button', { name: 'Drive’dan depo kontrol dosyası aç', exact: true }).click();
  await expect(page.getByText('Yapay rapor 21.xlsx', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Daha fazla rapor göster', exact: true }).click();
  await expect(page.getByText('Yapay rapor 21.xlsx', { exact: true })).toBeVisible();
  expect(dis()).toBe(0);
});
test('Drive ayar listesinde yirminci kayıttan sonrakine erişilir', async ({ page }) => {
  const dis = await ortam(page, 'oturum');
  await page.getByRole('button', { name: 'Drive’daki kayıtları göster', exact: true }).click();
  await expect(page.locator('.yedek-listesi li')).toHaveCount(20);
  await page.getByRole('button', { name: 'Daha fazla kayıt göster', exact: true }).click();
  await expect(page.locator('.yedek-listesi li')).toHaveCount(21);
  expect(dis()).toBe(0);
});
test('Drive bağlantısı yenilenince gizli rapor ekranının eski listesi temizlenir', async ({ page }) => {
  const dis = await ortam(page, 'rapor');
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  await page.getByRole('button', { name: 'Drive’dan depo kontrol dosyası aç', exact: true }).click();
  await expect(page.getByText('Yapay rapor 1.xlsx', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ayarlar', exact: true }).click();
  await page.getByRole('button', { name: 'Bağlantıyı kes', exact: true }).click();
  await page.getByRole('button', { name: 'Drive’a bağlan', exact: true }).click();
  await expect(page.getByText('Bağlı', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  await expect(page.locator('.yedek-listesi li')).toHaveCount(0);
  expect(dis()).toBe(0);
});
