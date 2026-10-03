import { test, expect, type Page } from '@playwright/test';
async function googleKur(page: Page, beklet = false) {
  await page.addInitScript((beklet) => {
    localStorage.setItem('bup-rapor:drive-istemci', 'yapay.apps.googleusercontent.com');
    Object.defineProperty(globalThis, 'google', {
      value: {
        accounts: {
          oauth2: {
            initTokenClient: (a: { callback: (r: unknown) => void }) => ({
              requestAccessToken: () => {
                const yanit = () =>
                  a.callback({
                    access_token: 'yalnizca-yapay-token',
                    expires_in: 3600,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                  });
                if (beklet) Object.defineProperty(globalThis, 'yapayGoogleYaniti', { value: yanit });
                else yanit();
              },
            }),
            revoke: (_: string, bitir: (r: unknown) => void) => bitir({ successful: true }),
          },
        },
      },
    });
  }, beklet);
  await page.goto('/CAL_bup/#/ayarlar');
  await page.getByRole('button', { name: 'Drive’a bağlan', exact: true }).click();
}
for (const tur of ['ag', 'sure', 'yazma'] as const)
  test(`taklit Drive ${tur} sonucu görünür; başarı yanlış ilan edilmez`, async ({ page, context }) => {
    let istek = false;
    await context.route('https://www.googleapis.com/**', (r) => {
      istek = true;
      if (tur === 'ag') return r.abort();
      if (tur === 'sure') return new Promise(() => undefined);
      if (r.request().method() === 'POST') return r.abort();
      const q = new URL(r.request().url()).searchParams.get('q') ?? '';
      return r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          files: q.includes("value='klasor'")
            ? [
                {
                  id: 'yapay-klasor',
                  name: 'CAL bup',
                  mimeType: 'application/vnd.google-apps.folder',
                  createdTime: '2026-10-04T00:00:00Z',
                  appProperties: { calbup: 'v1', tur: 'klasor' },
                },
              ]
            : [],
        }),
      });
    });
    await googleKur(page);
    if (tur === 'sure') await page.clock.install();
    await page
      .getByRole('button', {
        name: tur === 'yazma' ? 'Ayarları ve geçmişi eşitle' : 'Drive’daki kayıtları göster',
        exact: true,
      })
      .click();
    await expect.poll(() => istek).toBe(true);
    if (tur === 'sure') await page.clock.fastForward(121_000);
    const hata = page.locator('#islem-drive-ayar-hata');
    await expect(hata).toContainText(
      tur === 'ag' ? 'Drive’a ulaşılamadı' : tur === 'sure' ? 'süresi doldu' : 'sonucu doğrulanamadı',
    );
    await expect(hata).toBeInViewport();
    await expect(hata).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Drive’daki kayıtları göster', exact: true }),
    ).toBeEnabled();
    await expect(page.locator('.bildirim').filter({ hasText: 'Ayarlar Drive’a kaydedildi' })).toHaveCount(0);
  });

test('iptalden sonra geç gelen Google yanıtı bağlantıyı yeniden açmaz', async ({ page }) => {
  await googleKur(page, true);
  await page.getByRole('button', { name: 'İşlemi durdur', exact: true }).click();
  await expect(page.locator('#islem-drive-ayar-hata')).toContainText('durduruldu');
  await page.evaluate(() => {
    const f = Reflect.get(globalThis, 'yapayGoogleYaniti');
    if (typeof f === 'function') f();
  });
  await expect(page.getByText('Bağlı değil', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drive’a bağlan', exact: true })).toBeEnabled();
});
