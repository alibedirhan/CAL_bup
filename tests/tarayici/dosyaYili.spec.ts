import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

async function yukle(page: Page, yil?: number) {
  const w = new ExcelJS.Workbook();
  for (const gun of ['28.09', '29.09']) {
    const s = w.addWorksheet(gun);
    s.getCell('G1').value = 'GELEN MAL';
    s.getCell('A4').value = 'Yapay ürün';
    s.getCell('B5').value = { formula: 'SUM(B4:B4)', result: 0 };
    if (yil) {
      s.getCell('A3').value = `${gun}.${yil} LED`;
      s.getCell('C3').value = `${gun}.${yil} SAYIM`;
    }
  }
  await page.goto('/CAL_bup/');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'Yapay.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await w.xlsx.writeBuffer()),
    });
  await expect(page.locator('#gun-girdisi')).toBeVisible();
}

test('başlık yılı bilinen eski kitap bugünün yılına taşınmaz', async ({ page }) => {
  await yukle(page, 2023);
  await expect(page.getByText('30.09.2023 Cumartesi', { exact: false })).toBeVisible();
  await expect(page.locator('#dosya-yili')).toHaveCount(0);
});
test('başlıksız dosyanın yılı açıkça kontrol edilmeden gün seçimi ilerlemez', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await yukle(page);
  await expect(page.getByRole('heading', { name: 'Dosya yılı kontrolü bekleniyor' })).toBeVisible();
  await page.getByLabel('Dosyanın son gün yılı').fill('2023');
  await page.getByRole('button', { name: 'Dosya yılını kontrol ettim' }).click();
  await expect(page.getByText('30.09.2023 Cumartesi', { exact: false })).toBeVisible();
  await page.getByLabel('Dosyanın son gün yılı').fill('2024');
  await expect(page.getByRole('heading', { name: 'Dosya yılı kontrolü bekleniyor' })).toBeVisible();
  await expect(page.locator('#gun-aciklama')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/cal-bup-1.8.0-dosya-yili-dar.png', fullPage: true });
});
test('boş/kesirli/yanlış yıl hatası açıklanır ve onay verilemez', async ({ page }) => {
  await yukle(page);
  for (const y of ['', '202', '20.2', '1899']) {
    await page.getByLabel('Dosyanın son gün yılı').fill(y);
    await expect(page.getByRole('button', { name: 'Dosya yılını kontrol ettim' })).toBeDisabled();
    await expect(page.locator('.alan-hatasi')).toBeVisible();
  }
});

test('yıl değişince pazar atlama önerisi ve onay bekleyen gün birlikte yenilenir', async ({ page }) => {
  await yukle(page);
  await page.getByLabel('Dosyanın son gün yılı').fill('2029');
  // 29 Eylül 2029 Cumartesi; pazar atlanınca 1 Ekim önerilir.
  await expect(page.locator('#gun-girdisi')).toHaveAttribute('placeholder', '01.10');
  await expect(page.getByRole('heading', { name: 'Dosya yılı kontrolü bekleniyor' })).toBeVisible();
  await page.getByRole('button', { name: 'Dosya yılını kontrol ettim' }).click();
  await expect(page.locator('#gun-aciklama')).toContainText('01.10.2029 Pazartesi');
});
