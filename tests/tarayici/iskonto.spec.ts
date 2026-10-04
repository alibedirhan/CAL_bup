import { test, expect, type Page, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import referans from '../yardimci/veriler/iskontoReferansi.json' with { type: 'json' };

const ADRES = '/CAL_bup/#/satis/iskonto';
async function yukle(page: Page, indexler = [0, 1, 2]) {
  await page.getByLabel('PDF fiyat listeleri', { exact: true }).setInputFiles(
    indexler.map((i) => {
      const d = referans.belgeler[i];
      if (!d) throw new Error('Yapay başvuru yok.');
      return { name: d.ad, mimeType: 'application/pdf', buffer: Buffer.from(d.bayt, 'base64') };
    }),
  );
  await expect(page.getByRole('button', { name: 'Önizleme oluştur', exact: true })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.getByRole('status').filter({ hasText: 'PDF fiyat listeleri okunuyor' })).toHaveCount(0, {
    timeout: 30_000,
  });
}
async function onizle(page: Page) {
  await page.getByRole('button', { name: 'Önizleme oluştur', exact: true }).click();
  await expect(page.getByRole('table', { name: 'İskonto sonuç tablosu', exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
async function indir(page: Page, ad: string): Promise<Download> {
  const bekle = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: ad, exact: true }).click();
  return bekle;
}
async function bayt(d: Download) {
  const path = await d.path();
  if (!path) throw new Error('Yapay indirme yok.');
  return readFile(path);
}
async function excel(d: Download) {
  const w = new ExcelJS.Workbook();
  await w.xlsx.load((await bayt(d)) as unknown as ExcelJS.Buffer);
  return w;
}

test('İskonto: özgün motor kapalı ağda okur, kategori oranları ve tam/görünen Excel kapsamı korunur', async ({
  page,
  context,
}) => {
  const disIstekler: string[] = [];
  context.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4180/')) disIstekler.push(new URL(r.url()).origin);
  });
  await page.goto('/CAL_bup/');
  await page
    .getByRole('navigation', { name: 'Satış', exact: true })
    .getByRole('link', { name: 'İskonto Hesaplama', exact: true })
    .click();
  await yukle(page);
  await page.getByRole('button', { name: 'Tüm kategorileri %10 yap', exact: true }).click();
  await onizle(page);
  const tablo = page.getByRole('table', { name: 'İskonto sonuç tablosu' });
  await expect(tablo.locator('tbody tr')).toHaveCount(10);
  await expect(tablo).toContainText('90,90 TL');
  await page.getByLabel('Ürün ara', { exact: true }).fill('Yapay İki');
  await expect(tablo.locator('tbody tr')).toHaveCount(1);
  const gorunen = await excel(await indir(page, 'Görünenleri Excel’e aktar (1)'));
  expect(gorunen.worksheets.map((s) => s.name)).toEqual(['Görünen Satırlar', 'Kapsam']);
  expect(gorunen.worksheets[0]?.getCell('C2').value).toBe('Yapay İki');
  // Özgün Python hesabı: round(112.5 * 1.01, 2) = 113.62.
  expect(gorunen.worksheets[0]?.getCell('E2').value).toBe(113.62);
  const tam = await excel(await indir(page, 'Excel’e aktar'));
  expect(tam.worksheets).toHaveLength(4);
  expect(tam.getWorksheet('OZET')?.getCell('C2').value).toBe(2);
  expect(tam.worksheets[2]?.getCell('F3').value).toBe(90.9);
  expect(disIstekler).toEqual([]);
});

test('İskonto: tek PDF ve atomik Excel+PDF ZIP indirilir; Türkçe kaynak ve tarihler korunur', async ({
  page,
}) => {
  await page.goto(ADRES);
  await yukle(page, [2]);
  await onizle(page);
  const pdf = await indir(page, 'PDF’e aktar');
  expect(pdf.suggestedFilename()).toMatch(/^Yapay_Donuk_Iskontolu_\d{2}\.\d{2}\.\d{4}\.pdf$/);
  expect((await bayt(pdf)).subarray(0, 5).toString()).toBe('%PDF-');
  const paket = await JSZip.loadAsync(await bayt(await indir(page, 'Excel + PDF')));
  expect(Object.keys(paket.files)).toHaveLength(2);
  expect(paket.file('Iskontolu_Fiyat_Listeleri.xlsx')).not.toBeNull();
  expect(Object.keys(paket.files).some((n) => n.endsWith('.pdf'))).toBe(true);
});

test('İskonto: oran/dosya değişimi önizlemeyi kaldırır, geçersiz oran hesaplanmaz; rota oturumu korur', async ({
  page,
}) => {
  await page.goto(ADRES);
  await yukle(page, [0]);
  await onizle(page);
  await page.getByRole('link', { name: 'Müşteri Takip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Müşteri Takip', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'İskonto önizlemesi hazır' })).toHaveCount(0);
  await page.getByRole('link', { name: 'İskonto Hesaplama', exact: true }).click();
  await expect(page.getByRole('table', { name: 'İskonto sonuç tablosu' })).toBeVisible();
  await page.getByLabel('Bütün Piliç Ürünleri iskonto oranı', { exact: true }).fill('101');
  await expect(page.getByRole('table', { name: 'İskonto sonuç tablosu' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Önizleme oluştur', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('0–100');
  await page.getByLabel('Bütün Piliç Ürünleri iskonto oranı', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Önizleme oluştur', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('0–100');
  await page.getByRole('button', { name: 'Sıfırla', exact: true }).click();
  await onizle(page);
  await page.reload();
  await expect(page.getByText('Henüz PDF yüklenmedi.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Önizleme oluştur', exact: true })).toBeDisabled();
});

test('İskonto: bozuk PDF kısmi yüklenir, boş liste yanlış başarı üretmez ve üç dosya sınırı korunur', async ({
  page,
}) => {
  await page.goto(ADRES);
  const d = referans.belgeler[0];
  if (!d) throw new Error('Yapay başvuru yok.');
  await page.getByLabel('PDF fiyat listeleri', { exact: true }).setInputFiles([
    { name: d.ad, mimeType: 'application/pdf', buffer: Buffer.from(d.bayt, 'base64') },
    { name: 'Yapay bozuk.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-bozuk') },
  ]);
  await expect(page.getByRole('alert')).toContainText('Yapay bozuk.pdf', { timeout: 30_000 });
  await expect(page.getByRole('list', { name: 'Yüklenen PDF dosyaları' })).toContainText(d.ad);
  await onizle(page);
  await page.getByRole('button', { name: 'Temizle', exact: true }).click();
  await yukle(page, [10]);
  await page.getByRole('button', { name: 'Önizleme oluştur', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('İşlenecek veri bulunamadı!', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Temizle', exact: true }).click();
  await page.getByLabel('PDF fiyat listeleri', { exact: true }).setInputFiles(
    Array.from({ length: 4 }, (_, i) => ({
      name: `Yapay ${i}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(d.bayt, 'base64'),
    })),
  );
  await expect(page.getByRole('alert')).toContainText('En fazla üç PDF');
  await expect(page.getByText('Henüz PDF yüklenmedi.', { exact: true })).toBeVisible();
});

test('İskonto: filtre/sıralama sadece görünen kapsamı değiştirir, metin ilk on ürün kuralını korur', async ({
  page,
}) => {
  await page.goto(ADRES);
  await yukle(page, [9]);
  await page.getByRole('button', { name: 'Tüm kategorileri %10 yap', exact: true }).click();
  await onizle(page);
  await page.getByRole('button', { name: 'Metin önizlemesi', exact: true }).click();
  await expect(page.getByLabel('İskonto metin önizlemesi')).toContainText('... ve 2 ürün daha');
  await expect(page.getByLabel('İskonto metin önizlemesi')).toContainText('Kategori İskonto: 101.00 TL');
  await expect(page.locator('.iskonto-ozet')).toContainText('121,20 TL');
  await expect(
    page.getByRole('button', { name: 'Görünenleri Excel’e aktar (12)', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Ürün tablosu', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sıralama', exact: true }).selectOption('ad');
  await page.getByLabel('Ürün ara', { exact: true }).fill('Yapay Ürün 10');
  const w = await excel(await indir(page, 'Görünenleri Excel’e aktar (9)'));
  expect(w.worksheets[0]?.rowCount).toBe(10);
  await page.getByLabel('Ürün ara', { exact: true }).fill('');
  await page
    .getByRole('group', { name: 'Gösterilen kategoriler', exact: true })
    .getByLabel('Bütün Piliç Ürünleri', { exact: true })
    .uncheck();
  await expect(
    page.getByRole('button', { name: 'Görünenleri Excel’e aktar (0)', exact: true }),
  ).toBeDisabled();
  expect((await excel(await indir(page, 'Excel’e aktar'))).worksheets[1]?.rowCount).toBe(15);
});

test('İskonto: iptal ve rota çıkışı özgün motor işçisini kapatır; gecikmiş yanıt uygulanmaz', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class BekleyenIsci {
      onmessage = null;
      onerror = null;
      postMessage() {
        Reflect.set(globalThis, 'yapayIskontoBasladi', true);
      }
      terminate() {
        Reflect.set(globalThis, 'yapayIskontoKapandi', true);
      }
    }
    Reflect.set(globalThis, 'Worker', BekleyenIsci);
  });
  await page.goto(ADRES);
  const d = referans.belgeler[0];
  if (!d) throw new Error('Yapay başvuru yok.');
  await page
    .getByLabel('PDF fiyat listeleri', { exact: true })
    .setInputFiles({ name: d.ad, mimeType: 'application/pdf', buffer: Buffer.from(d.bayt, 'base64') });
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'yapayIskontoBasladi'))).toBe(true);
  await expect(page.getByRole('button', { name: 'PDF seç', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'İşlemi durdur', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'yapayIskontoKapandi'))).toBe(true);
  await expect(page.getByRole('button', { name: 'PDF seç', exact: true })).toBeEnabled();
  await page.evaluate(() => Reflect.set(globalThis, 'yapayIskontoKapandi', false));
  await page
    .getByLabel('PDF fiyat listeleri', { exact: true })
    .setInputFiles({ name: d.ad, mimeType: 'application/pdf', buffer: Buffer.from(d.bayt, 'base64') });
  await expect(page.getByRole('button', { name: 'İşlemi durdur', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Müşteri Takip', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'yapayIskontoKapandi'))).toBe(true);
  await expect(page.getByRole('heading', { name: 'Müşteri Takip', exact: true })).toBeVisible();
});

for (const tema of ['acik', 'koyu'])
  test(`İskonto ${tema}: kendi tema, klavye ve dar ekranda kullanılabilir`, async ({ page }) => {
    const hatalar: string[] = [];
    page.on('pageerror', (hata) => hatalar.push(hata.message));
    await page.addInitScript((tema) => localStorage.setItem('bup-rapor:tema', tema), tema);
    await page.goto(ADRES);
    await expect(page.locator('html')).toHaveAttribute('data-theme', tema === 'koyu' ? 'dark' : 'light');
    await yukle(page, [0]);
    await onizle(page);
    await page.getByLabel('Ürün ara', { exact: true }).focus();
    await page.keyboard.type('Alfa');
    await expect(page.getByRole('table', { name: 'İskonto sonuç tablosu' })).toContainText('Yapay Alfa');
    await page.getByRole('button', { name: 'Bildirimi kapat', exact: true }).click();
    await page.screenshot({ path: join(tmpdir(), `cal-iskonto-${tema}.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: join(tmpdir(), `cal-iskonto-${tema}-dar.png`), fullPage: true });
    expect(hatalar).toEqual([]);
  });

test('İskonto: bozuk motor paketi sonuç üretmez; tekrar denemede yeni işçi başarılıdır', async ({ page }) => {
  const adres = '**/python/openpyxl-*.whl*';
  await page.route(adres, (route) => route.fulfill({ body: Buffer.from('Yapay bozuk paket') }));
  await page.goto(ADRES);
  const d = referans.belgeler[0];
  if (!d) throw new Error('Yapay başvuru yok.');
  const dosya = { name: d.ad, mimeType: 'application/pdf', buffer: Buffer.from(d.bayt, 'base64') };
  await page.getByLabel('PDF fiyat listeleri', { exact: true }).setInputFiles(dosya);
  await expect(page.getByRole('alert')).toContainText('bütünlüğü doğrulanamadı', { timeout: 30_000 });
  await expect(page.getByText('Henüz PDF yüklenmedi.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Önizleme oluştur', exact: true })).toBeDisabled();
  await page.unroute(adres);
  await yukle(page, [0]);
  await onizle(page);
});
