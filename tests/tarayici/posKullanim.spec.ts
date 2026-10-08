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

test('cari profilinden “Cariyi sil” onayla siler; kart formundaki CVV maskeli ve kayıtlı kalır', async ({
  page,
}) => {
  await page.route(
    (u) => !u.toString().startsWith('http://127.0.0.1:4180/'),
    (r) => r.abort(),
  );
  await cariHazirla(page);
  await kartDoldur(page);
  const cvv = page.getByLabel('CVV (isteğe bağlı)', { exact: true });
  await cvv.fill('12a3');
  await expect(cvv).toHaveValue('123');
  await expect(cvv).toHaveCSS('-webkit-text-security', 'disc');
  // Alan değişince kontrol kutusu yeniden işaretlenmelidir.
  await page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.locator('.pos-odeme-karti')).toContainText('CVV •••');
  // Düzenlemede kayıtlı CVV maskeli olarak geri gelir.
  await page.getByRole('button', { name: 'Yapay Denetim Kartı kartını düzenle' }).click();
  await expect(page.getByLabel('CVV (isteğe bağlı)', { exact: true })).toHaveValue('123');
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await page.locator('.pos-odeme-karti').click();
  await expect(page.locator('.pos-secili-kart')).toContainText('CVV•••');

  // Vazgeçilen silme hiçbir şeyi değiştirmez.
  page.once('dialog', (d) => {
    expect(d.message()).toContain('1 kart silinsin mi');
    void d.dismiss();
  });
  await page.getByRole('button', { name: 'Cariyi sil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yapay Denetim Carisi', exact: true })).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Cariyi sil', exact: true }).click();
  await expect(page.getByText('Henüz cari yok.', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Henüz cari yok.', { exact: false })).toBeVisible();
});
