import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const KOVALAR = [
  'Açık Hesap',
  '0-7 Gün',
  '8-14 Gün',
  '15-21 Gün',
  '22-28 Gün',
  '29-35 Gün',
  '36-42 Gün',
  '43-49 Gün',
  '50-56 Gün',
  '57-63 Gün',
  '64-70 Gün',
  '71-77 Gün',
  '77+ Gün',
];

test('Yaşlandırma: 20.000 yapay satır / 60 araç, masaüstü hesabı ve kullanılabilir ana ekran', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const satir = 20_000,
    arac = 60;
  const w = new ExcelJS.Workbook();
  const s = w.addWorksheet('Yapay');
  s.addRow(['C01Y.Cari Yaşlandırma Raporu']);
  s.addRow(['Cari Kategori 3', 'Cari Ünvan', ...KOVALAR]);
  let toplam = 0;
  for (let i = 0; i < satir; i++) {
    const tutarlar = KOVALAR.map((_, k) => ((i * 7 + k * 13) % 97) + (k === 5 ? 0.5 : 0));
    toplam += tutarlar.reduce((a, b) => a + b, 0);
    s.addRow([`[İZMİR ARAÇ ${String((i % arac) + 1).padStart(2, '0')}]`, `Yapay Müşteri ${i}`, ...tutarlar]);
  }
  const bayt = Buffer.from(await w.xlsx.writeBuffer());
  await page.goto('/CAL_bup/#/satis/yaslandirma');
  await page.getByLabel('Yaşlandırma raporu', { exact: true }).setInputFiles({
    name: 'Yapay büyük yaşlandırma.xlsx',
    mimeType: 'application/octet-stream',
    buffer: bayt,
  });
  await page.evaluate(() => {
    const olcum = { baslangic: performance.now(), son: performance.now(), enUzun: 0, tik: 0 };
    const zaman = setInterval(() => {
      const simdi = performance.now();
      olcum.enUzun = Math.max(olcum.enUzun, simdi - olcum.son);
      olcum.son = simdi;
      olcum.tik++;
    }, 10);
    Reflect.set(globalThis, 'yapayYaslandirmaOlcumu', { olcum, zaman });
  });
  await page.getByRole('button', { name: 'Analiz et', exact: true }).click();
  const tablo = page.getByRole('table', { name: 'Araç bazlı yaşlandırma özeti', exact: true });
  // Bekleme, testin kendi süre ölçütüyle aynıdır; ana ekranın donmadığı ayrıca ölçülür.
  await expect(tablo.locator('tbody tr')).toHaveCount(arac, { timeout: 120_000 });
  await expect(page.locator('.musteri-ozet dd').nth(1)).toHaveText('20.000');
  const beklenen =
    toplam.toLocaleString('tr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
  await expect(page.locator('.musteri-ozet dd').nth(2)).toHaveText(beklenen);
  const olcum = await page.evaluate(() => {
    const { olcum, zaman } = Reflect.get(globalThis, 'yapayYaslandirmaOlcumu') as {
      olcum: { baslangic: number; enUzun: number; tik: number };
      zaman: number;
    };
    clearInterval(zaman);
    return {
      satir: 20_000,
      sureMs: performance.now() - olcum.baslangic,
      enUzunBeklemeMs: olcum.enUzun,
      tik: olcum.tik,
    };
  });
  await writeFile(join(tmpdir(), 'cal-yaslandirma-performans.json'), JSON.stringify(olcum, null, 2));
  expect(olcum.tik).toBeGreaterThan(10);
  expect(olcum.enUzunBeklemeMs).toBeLessThan(1500);
  expect(olcum.sureMs).toBeLessThan(120_000);
  await page.getByLabel('Araç no veya cari ara').fill('Yapay Müşteri 19999');
  await expect(tablo.locator('tbody tr')).toHaveCount(1);
});
