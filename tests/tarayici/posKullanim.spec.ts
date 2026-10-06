import { test, expect } from '@playwright/test';
import { cariHazirla, kartDoldur } from './yardimci';

test('cari profili işlem sırasını gösterir; seçili kart iki yolu ayrı başlıklarla sunar', async ({
  page,
}) => {
  // Gerçek POS adresine hiçbir istek gitmez: yerel sunucu dışındaki her istek kesilir.
  const disIstekler: string[] = [];
  await page.route(
    (u) => !u.toString().startsWith('http://127.0.0.1:4180/'),
    (r) => {
      disIstekler.push(r.request().url());
      return r.abort();
    },
  );
  await page.setViewportSize({ width: 1366, height: 657 });
  await cariHazirla(page);
  const sira = page.locator('.pos-sira li');
  await expect(sira).toHaveCount(3);
  await expect(sira.nth(1)).toContainText('Seçili kartla POS’u aç');

  await kartDoldur(page);
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await page.locator('.pos-odeme-karti').click();
  const panel = page.locator('.pos-secili-kart');
  await expect(panel.getByRole('heading', { name: 'Seçilen kart: Yapay Denetim Kartı' })).toBeVisible();
  await expect(panel).toContainText('•••• •••• •••• 4242 · 12/2035');
  await expect(panel.getByRole('heading', { name: 'Kart bilgilerini elle kopyala' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kart numarasını kopyala', exact: true })).toBeDisabled();
  await expect(panel).toContainText('“Elle POS’a giriş” bölümünden POS’u açın');

  // Elle giriş bölümü: ayrıntılar kapalı başlar, açılınca açıklamalar görünür
  const ayrinti = page.locator('.pos-ayrinti');
  await expect(ayrinti.getByText('POS’taki bakiye ödeme tutarı değildir', { exact: false })).toBeHidden();
  await ayrinti.getByText('Ayrıntılar', { exact: true }).click();
  await expect(ayrinti.getByText('POS’taki bakiye ödeme tutarı değildir', { exact: false })).toBeVisible();
  const elle = page.getByRole('link', { name: 'Giriş sayfasını elle aç' });
  await expect(elle).toHaveCSS('text-decoration-line', 'none');
  expect(disIstekler).toEqual([]);
});
