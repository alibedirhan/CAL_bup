import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
test('Kârlılık: 12.000 üründe özgün hesap ve ana ekran yanıtı korunur', async ({ page }) => {
  const adet = 12_000;
  async function kitap(tur: 'satis' | 'fiyat') {
    const w = new ExcelJS.Workbook(),
      s = w.addWorksheet('Yapay');
    s.addRow(
      tur === 'satis'
        ? ['Stok İsmi', 'Satış Miktar', 'Ort Satış Fiyat', 'Satış Tutar']
        : ['Stok İsim', 'Tarih', 'Depo', 'Fiyat'],
    );
    for (let i = 0; i < adet; i++)
      s.addRow(
        tur === 'satis'
          ? [`YAPAY ${String(i).padStart(5, '0')}`, 2, 15, 30]
          : [null, null, `YAPAY ${String(i).padStart(5, '0')}`, 10],
      );
    return Buffer.from(await w.xlsx.writeBuffer());
  }
  await page.goto('/CAL_bup/#/satis/karlilik');
  for (const [tur, label] of [
    ['satis', 'Kârlılık satış raporu'],
    ['fiyat', 'Kârlılık fiyat raporu'],
  ] as const)
    await page.getByLabel(label, { exact: true }).setInputFiles({
      name: `Yapay ${tur}.xlsx`,
      mimeType: 'application/octet-stream',
      buffer: await kitap(tur),
    });
  await page.evaluate(() => {
    const olcum = { baslangic: performance.now(), son: performance.now(), enUzun: 0, tik: 0 };
    const zaman = setInterval(() => {
      const simdi = performance.now();
      olcum.enUzun = Math.max(olcum.enUzun, simdi - olcum.son);
      olcum.son = simdi;
      olcum.tik++;
    }, 10);
    Reflect.set(globalThis, 'calKarlilikOlcumu', { olcum, zaman });
  });
  await page.getByRole('button', { name: 'Analiz et', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.karlilik-sonuc .musteri-ozet dd').first()).toHaveText('12.000');
  await expect(page.locator('.karlilik-sonuc .musteri-ozet dd').last()).toHaveText('120.000,00 TL');
  await expect(
    page.getByRole('table', { name: 'Kârlılık sonuç tablosu' }).locator('tbody tr').first(),
  ).toContainText('10,00 TL');
  const olcum = await page.evaluate(() => {
    const { olcum, zaman } = Reflect.get(globalThis, 'calKarlilikOlcumu') as {
      olcum: { baslangic: number; son: number; enUzun: number; tik: number };
      zaman: number;
    };
    clearInterval(zaman);
    return {
      satir: 12_000,
      sureMs: performance.now() - olcum.baslangic,
      enUzunBeklemeMs: olcum.enUzun,
      tik: olcum.tik,
    };
  });
  await writeFile(join(tmpdir(), 'cal-karlilik-performans.json'), JSON.stringify(olcum, null, 2));
  expect(olcum.tik).toBeGreaterThan(10);
  expect(olcum.enUzunBeklemeMs).toBeLessThan(1500);
  expect(olcum.sureMs).toBeLessThan(30_000);
});
