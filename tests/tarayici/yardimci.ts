import { expect, type Page } from '@playwright/test';
export async function cariHazirla(page: Page) {
  await page.goto('/CAL_bup/#/sanal-pos');
  await page.getByRole('button', { name: 'Yeni cari', exact: true }).click();
  await page.getByLabel('Cari adı', { exact: true }).fill('Yapay Denetim Carisi');
  await page.getByLabel('Vergi/TC numarası', { exact: true }).fill('0123456789');
  await page.getByLabel('Cari adı ve numaranın aynı kişiye ait olduğunu kontrol ettim.').check();
  await page.getByRole('button', { name: 'Cariyi kaydet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yapay Denetim Carisi', exact: true })).toBeVisible();
}
export async function kartDoldur(page: Page, ad = 'Yapay Denetim Kartı') {
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page.getByLabel('Karta vereceğiniz isim').fill(ad);
  await page.getByLabel('Kart numarası', { exact: true }).fill('4242424242424242');
  await page.getByLabel('Son kullanma ayı', { exact: true }).selectOption('12');
  await page.getByLabel('Son kullanma yılı', { exact: true }).selectOption('2035');
  await page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
}
export async function yapayFoto(page: Page, bos = false) {
  return Buffer.from(
    await page.evaluate((bos) => {
      const c = document.createElement('canvas');
      c.width = 1500;
      c.height = 650;
      const x = c.getContext('2d');
      if (!x) throw new Error('Canvas yok');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, c.width, c.height);
      if (!bos) {
        x.fillStyle = '#000';
        x.font = '64px monospace';
        x.fillText('4242 4242 4242 4242', 90, 250);
        x.fillText('12/35', 90, 420);
      }
      return c.toDataURL().split(',')[1] ?? '';
    }, bos),
    'base64',
  );
}
