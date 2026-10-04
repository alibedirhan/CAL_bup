import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Müşteri Takip: 40.000 yapay satır, doğru sonuç ve kullanılabilir ana ekran', async ({ page }) => {
  const satirSayisi = 40_000;
  async function dosya(sayi: number) {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet('Yapay');
    s.addRow(['Cari Ünvan']);
    for (let i = 0; i < sayi; i++) s.addRow([`Yapay Müşteri ${i}`]);
    return Buffer.from(await w.xlsx.writeBuffer());
  }
  await page.goto('/CAL_bup/#/satis/musteri-takip');
  await page.getByLabel('Eski tarihli Excel', { exact: true }).setInputFiles({
    name: 'Yapay eski.xlsx',
    mimeType: 'application/octet-stream',
    buffer: await dosya(satirSayisi),
  });
  await page.getByLabel('Yeni tarihli Excel', { exact: true }).setInputFiles({
    name: 'Yapay yeni.xlsx',
    mimeType: 'application/octet-stream',
    buffer: await dosya(satirSayisi - 1),
  });
  await page.evaluate(() => {
    const olcum = { baslangic: performance.now(), son: performance.now(), enUzun: 0, tik: 0 };
    const zaman = setInterval(() => {
      const simdi = performance.now();
      olcum.enUzun = Math.max(olcum.enUzun, simdi - olcum.son);
      olcum.son = simdi;
      olcum.tik++;
    }, 10);
    Reflect.set(globalThis, 'yapayMusteriOlcumu', { olcum, zaman });
  });
  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Eksik müşteriler', exact: true })).toContainText(
    'Yapay Müşteri 39999',
  );
  await expect(page.locator('.musteri-ozet dd').first()).toHaveText('40.000');
  await page.waitForTimeout(20);
  const olcum = await page.evaluate(() => {
    const { olcum, zaman } = Reflect.get(globalThis, 'yapayMusteriOlcumu') as {
      olcum: { baslangic: number; son: number; enUzun: number; tik: number };
      zaman: number;
    };
    clearInterval(zaman);
    Reflect.deleteProperty(globalThis, 'yapayMusteriOlcumu');
    return {
      satir: 40_000,
      sureMs: performance.now() - olcum.baslangic,
      enUzunBeklemeMs: olcum.enUzun,
      tik: olcum.tik,
    };
  });
  await writeFile(join(tmpdir(), 'cal-musteri-performans.json'), JSON.stringify(olcum, null, 2));
  expect(olcum.tik).toBeGreaterThan(10);
  expect(olcum.enUzunBeklemeMs).toBeLessThan(1500);
  expect(olcum.sureMs).toBeLessThan(30_000);
});
