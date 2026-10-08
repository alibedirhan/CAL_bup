import { test, expect, type Page } from '@playwright/test';
import { posKilidiniAc } from './yardimci';
import ExcelJS from 'exceljs';

async function yapayExcel(adlar: readonly string[], depo = 'İZMİR ARAÇ 06') {
  const w = new ExcelJS.Workbook();
  const s = w.addWorksheet('Yapay');
  s.addRow(['Yapay müşteri raporu']);
  s.addRow([`Cari Kategori 3 [YAPAY] ${depo}`]);
  s.addRow(['Kod', 'Cari Ünvan']);
  adlar.forEach((ad) => s.addRow(['YAPAY', ad]));
  return Buffer.from(await w.xlsx.writeBuffer());
}

async function listeleriSec(page: Page) {
  for (const [yon, adlar] of [
    ['Eski', ['Yapay Alfa', 'Yapay Beta']],
    ['Yeni', ['Yapay Alfa', 'Yapay Gamma']],
  ] as const)
    await page.getByLabel(`${yon} tarihli Excel`, { exact: true }).setInputFiles({
      name: `Yapay ${yon} uzun bir dosya adı ile ${'x'.repeat(60)}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await yapayExcel(adlar),
    });
}

test('iş yeri ekranında Karşılaştır görünür; sonuç depo ve Excel başlığını söyler', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  await page.clock.install();
  await page.goto('/CAL_bup/#/satis/musteri-takip');
  await listeleriSec(page);
  await expect(page.getByRole('button', { name: 'Karşılaştır', exact: true })).toBeInViewport();
  await expect(page.getByText('İki dosya da seçildi. Soldaki Karşılaştır düğmesine basın.')).toBeVisible();
  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Karşılaştırma sonucu', exact: true })).toBeVisible();
  const ozet = page.locator('.musteri-kaynak-ozet');
  await expect(ozet).toContainText('Depo: İZMİR ARAÇ 06 · Excel başlığı: İZMİR ARAÇ 06');
  await expect(ozet).toContainText('Araç/plasiyer ayarları');

  // Başarı bildirimi bir süre sonra kendiliğinden kapanır ve düğmeleri örtmeye devam etmez
  const bildirim = page.locator('.bildirim');
  await expect(bildirim).toContainText('Müşteri listeleri karşılaştırıldı.');
  await page.clock.runFor(13_000);
  await expect(bildirim).toHaveCount(0);

  // Hiç eşleştirme yokken ayarlar boş bir satırla açılır; eklenen plasiyer başlıkta görünür
  await page.getByRole('button', { name: 'Araç/plasiyer ayarları', exact: true }).click();
  await page.getByLabel('Araç 1', { exact: true }).fill('06');
  await page.getByLabel('Plasiyer 1', { exact: true }).fill('Yapay Plasiyer');
  await page.getByRole('button', { name: 'Ayarları kaydet', exact: true }).click();
  await expect(page.getByText('Araç/plasiyer ayarları kaydedildi.')).toBeVisible();
  await expect(ozet).toContainText('Excel başlığı: Araç 06 - Yapay Plasiyer');
  await expect(ozet).not.toContainText('Araç/plasiyer ayarları');
});

test('hata bildirimi kendiliğinden kapanmaz', async ({ page }) => {
  await page.clock.install();
  await page.goto('/CAL_bup/#/sanal-pos');
  await posKilidiniAc(page);
  await page.getByRole('button', { name: 'Yeni cari', exact: true }).click();
  await page.getByLabel('Cari adı', { exact: true }).fill('Yapay Hata Carisi');
  await page.getByLabel('Vergi/TC numarası', { exact: true }).fill('12');
  await page.getByLabel('Cari adı ve numaranın aynı kişiye ait olduğunu kontrol ettim.').check();
  await page.getByRole('button', { name: 'Cariyi kaydet', exact: true }).click();
  const hata = page.getByRole('alert').first();
  await expect(hata).toBeVisible();
  await page.clock.runFor(30_000);
  await expect(hata).toBeVisible();
});
