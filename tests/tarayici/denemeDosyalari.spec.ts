import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

test('indirilebilir yapay kabul paketi gerçek rapor akışında beklenen Excel sonucunu üretir', async ({
  page,
}) => {
  await page.goto('/CAL_bup/#/ayarlar');
  const [indirme] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Deneme dosyalarını indir' }).click(),
  ]);
  const yol = await indirme.path();
  if (!yol) throw new Error('Yapay paket indirilemedi');
  const zip = await JSZip.loadAsync(await readFile(yol));
  expect(await zip.file('DENEME.txt')?.async('string')).toContain('B7=17, D7=16, E7=1');
  const dosyalar = await Promise.all(
    Object.keys(zip.files)
      .filter((a) => a.endsWith('.xlsx'))
      .map(async (name) => ({
        name,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: (await zip.files[name]?.async('nodebuffer')) ?? Buffer.alloc(0),
      })),
  );
  expect(dosyalar).toHaveLength(4);
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  await page.locator('input[type=file]').last().setInputFiles(dosyalar);
  await expect(page.getByRole('button', { name: 'İndir', exact: true })).toBeEnabled();
  const [cikti] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'İndir', exact: true }).click(),
  ]);
  const ciktiYolu = await cikti.path();
  if (!ciktiYolu) throw new Error('Yapay rapor indirilemedi');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(ciktiYolu)) as unknown as ExcelJS.Buffer);
  const s = wb.getWorksheet('02.10');
  expect(s).toBeTruthy();
  for (const [adres, deger] of [
    ['B7', 17],
    ['D7', 16],
    ['E7', 1],
    ['H2', undefined],
  ] as const)
    expect(s?.getCell(adres).result).toBe(deger);
  expect(s?.getCell('G2').value).toBe(7);
  expect(s?.getCell('H2').formula).toBe('D7');
  expect(s?.getCell('A6').value).toBe('YAPAY YENİ');
  expect(s?.pageSetup.printArea).toBe('A1:H7');
  expect(s?.autoFilter).toBe('A3:E6');
  expect(wb.getWorksheet('01.10')?.getCell('B6').result).toBe(0);
  expect(wb.worksheets.map((w) => w.name)).toEqual(['30.09', '01.10', '02.10', 'Bilgilendirme']);
  // Sorumluluk notu (1.19.0): sayım fişinin adıyla gün sayfasında, bağlantı Bilgilendirme'de
  const not = String(s?.getCell('J1').value);
  expect(not).toMatch(/^Depo sayımı, depo sorumlusunun 02\.10\.2026 sayımından \(.+\.xlsx\) alınmıştır\.$/);
  expect(wb.getWorksheet('Bilgilendirme')?.getCell('A9').formula).toBe(
    'HYPERLINK("#\'02.10\'!A1","Okudum, 02.10 gün sayfasına geç →")',
  );
  await expect(page.getByText('02.10 sayfası hazır, indirme başlatıldı')).toBeVisible();
  await expect(page.getByText('Dosya Bilgilendirme sayfasıyla açılır')).toBeVisible();
});
