import { test, expect } from '@playwright/test';
import { yapayKartliCari } from './eklentiYardimci';
import { programiYereldenSun } from './programTaklidi';
test.beforeEach(async ({ page }) => {
  await page.context().route('**/*', programiYereldenSun);
});
test('yardımcı bağlantısı başarısızken kontrol ediliyor mesajı kalmaz', async ({ page }) => {
  await yapayKartliCari(page);
  await page.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
  await expect(page.locator('#pos-aktarim-hatasi')).toContainText('bağlı değil', { timeout: 8000 });
  await expect(page.getByRole('status').filter({ hasText: 'POS yardımcısı kontrol ediliyor' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true })).toBeEnabled();
  expect(page.context().pages()).toHaveLength(1);
  for (const koyu of [false, true]) {
    if (koyu) await page.getByRole('button', { name: 'Koyu', exact: true }).click();
    const alan = page.getByRole('region', { name: 'Seçili kartı POS’a aktar' });
    const normal = await alan
      .locator('p.ipucu')
      .first()
      .evaluate((e) => getComputedStyle(e).color);
    const hataRengi = await page.locator('#pos-aktarim-hatasi').evaluate((e) => getComputedStyle(e).color);
    expect(hataRengi).not.toBe(normal);
    await expect(page.locator('#pos-aktarim-hatasi')).toHaveCSS('border-left-width', '3px');
  }
});
test('eski yardımcının sürümü doğrulanmadan kart bilgisi gönderilmez', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(window, 'yapayKartMesaji', 0);
    window.addEventListener('message', (e) => {
      if (e.data?.kanal !== 'CAL_BUP_POS_1') return;
      if (e.data.is === 'baslat') Reflect.set(window, 'yapayKartMesaji', 1);
      window.postMessage(
        {
          kanal: 'CAL_BUP_POS_YANIT_1',
          id: e.data.id,
          sonuc: { durum: 'hazir', mesaj: 'Yapay eski yardımcı' },
        },
        location.origin,
      );
    });
  });
  await yapayKartliCari(page);
  await page.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
  await expect(page.locator('#pos-aktarim-hatasi')).toContainText('güncelle');
  expect(await page.evaluate(() => Reflect.get(window, 'yapayKartMesaji'))).toBe(0);
});
test('iptal edilen bağlantının eski zaman aşımı yeni sonucu değiştirmez', async ({ page }) => {
  await yapayKartliCari(page);
  await page.getByRole('button', { name: 'Yardımcı bağlantısını kontrol et', exact: true }).click();
  await page.getByRole('button', { name: 'Aktarımı durdur', exact: true }).click();
  await page.evaluate(() => {
    window.addEventListener('message', (e) => {
      if (e.data?.kanal === 'CAL_BUP_POS_1')
        window.postMessage(
          {
            kanal: 'CAL_BUP_POS_YANIT_1',
            id: e.data.id,
            sonuc: { durum: 'hazir', mesaj: 'Yapay', protokol: 3, surum: '1.6.1' },
          },
          location.origin,
        );
    });
  });
  await page.getByRole('button', { name: 'Yardımcı bağlantısını kontrol et', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'POS yardımcısı bağlı (1.6.1)' })).toBeVisible();
  await page.waitForTimeout(5500);
  await expect(page.locator('#pos-aktarim-hatasi')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'POS yardımcısı bağlı (1.6.1)' })).toBeVisible();
});
