import { test, expect, type Page, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';
import referans from '../yardimci/veriler/karlilikReferansi.json' with { type: 'json' };
const ADRES = '/CAL_bup/#/satis/karlilik';
async function yukle(page: Page, index = 0) {
  const s = referans.senaryolar[index];
  if (!s) throw new Error('Başvuru yok.');
  for (const [tur, label] of [
    ['satis', 'Kârlılık satış raporu'],
    ['fiyat', 'Kârlılık fiyat raporu'],
  ] as const)
    await page.getByLabel(label, { exact: true }).setInputFiles({
      name: `Yapay ${tur}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(s.girdiler[tur], 'base64'),
    });
  await page.getByRole('button', { name: 'Analiz et', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu', exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
async function bolum(page: Page, ad: string) {
  await page.getByRole('button', { name: ad, exact: true }).click();
}
async function indir(page: Page, ad: string): Promise<Download> {
  const d = page.waitForEvent('download', { timeout: 30_000 });
  await bolum(page, ad);
  return d;
}
async function excel(d: Download) {
  const path = await d.path();
  if (!path) throw new Error('İndirme yok.');
  const w = new ExcelJS.Workbook();
  await w.xlsx.load((await readFile(path)) as unknown as ExcelJS.Buffer);
  return w;
}
async function hazir(page: Page) {
  await expect(page.getByRole('button', { name: 'İşlemi durdur', exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
}

test('Kârlılık: özgün hesap, uyarı, filtre ve tam/görünen çıktı kapsamı kapalı ağda korunur', async ({
  page,
  context,
}) => {
  const dis: string[] = [];
  context.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4180/')) dis.push(r.url());
  });
  await page.goto('/CAL_bup/');
  await page
    .getByRole('navigation', { name: 'Satış', exact: true })
    .getByRole('link', { name: 'Kârlılık Analizi', exact: true })
    .click();
  await yukle(page);
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  const tablo = page.getByRole('table', { name: 'Kârlılık sonuç tablosu' });
  await expect(tablo.locator('tbody tr')).toHaveCount(s.ozet.total_count);
  await expect(page.getByRole('note')).toContainText('maliyet 0');
  await page.getByLabel('Stok ara', { exact: true }).fill('Alfa');
  await page.getByLabel('Sıralama', { exact: true }).selectOption('dusuk');
  const gorunen = await excel(await indir(page, 'Görünenleri Excel’e aktar (2)'));
  expect(gorunen.worksheets.map((s) => s.name)).toEqual(['Görünen Satırlar', 'Kapsam']);
  expect(gorunen.worksheets[0]?.getCell('G2').value).toBe(
    s.ozet.rows.find((r) => r.sales_quantity === -2)?.net_profit,
  );
  const tam = await excel(await indir(page, 'Excel’e aktar'));
  expect(tam.worksheets.map((s) => s.name)).toEqual(['Karlılık Analizi', 'Özet']);
  expect(tam.worksheets[0]?.rowCount).toBe(s.ozet.total_count + 1);
  expect(tam.worksheets[0]?.getColumn(1).values).toContain("'=YAPAY()");
  await page.getByLabel('Stok ara', { exact: true }).fill('');
  await page.getByLabel('Sadece negatif marj', { exact: true }).check();
  await expect(tablo.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Sadece negatif marj', { exact: true }).uncheck();
  await page.getByLabel('Eşleşmeyenleri gizle', { exact: true }).check();
  await expect(tablo.locator('tbody tr')).toHaveCount(s.ozet.matched_count);
  expect(dis).toEqual([]);
});
test('Kârlılık: genel bakış ve senaryo marj/Pareto/Excel; oran değişince eski çıktı geçersiz', async ({
  page,
}) => {
  await page.goto(ADRES);
  await yukle(page);
  await bolum(page, 'Genel Bakış');
  await expect(page.getByLabel('Ürünlerin net kârı')).toContainText('YAPAY');
  await page.getByRole('button', { name: /^Zararda \(/ }).click();
  await expect(page.getByLabel('Ürünlerin net kârı')).toContainText('YAPAY BETA');
  await bolum(page, 'Senaryo');
  await page.getByLabel('Maliyet değişimi (%)', { exact: true }).fill('10');
  await page.getByLabel('Fiyat değişimi (%)', { exact: true }).fill('5');
  await page.getByLabel('Miktar değişimi (%)', { exact: true }).fill('-5');
  await expect(page.getByRole('button', { name: 'Senaryoyu Excel’e aktar', exact: true })).toBeDisabled();
  await bolum(page, 'Senaryoyu hesapla');
  await expect(page.getByRole('table', { name: 'Kârlılık senaryo tablosu' })).toBeVisible({
    timeout: 30_000,
  });
  const w = await excel(await indir(page, 'Senaryoyu Excel’e aktar'));
  const sc = referans.senaryolar[0]?.senaryolar[1];
  expect(w.worksheets.map((s) => s.name)).toEqual(['Senaryo Özeti', 'Ürün Senaryosu']);
  expect(w.worksheets[0]?.getCell('B6').value).toBe(sc?.excel[0]?.satirlar[5]?.[1]);
  await page.getByLabel('Maliyet değişimi (%)', { exact: true }).fill('501');
  await bolum(page, 'Senaryoyu hesapla');
  await expect(page.getByRole('alert')).toContainText('−100 ile 500');
  await expect(page.getByRole('table', { name: 'Kârlılık senaryo tablosu' })).toHaveCount(0);
});
test('Kârlılık: öneri onaylanmadan hesap değişmez; onay/kaldırma/geri alma kalıcıdır', async ({ page }) => {
  await page.goto(ADRES);
  await yukle(page);
  await bolum(page, 'Eşleşme Merkezi');
  await page.getByLabel('Eşleşmeyen satış stoğu', { exact: true }).selectOption('YAPAY TAKMA');
  await page.getByLabel('Fiyat stoğu', { exact: true }).selectOption('YAPAY ALFA');
  await bolum(page, 'Eşleştirme öner');
  await hazir(page);
  await expect(page.getByLabel('Stok eşleştirmeleri')).toContainText('Onay bekliyor');
  await bolum(page, 'Analiz');
  await expect(page.getByRole('note')).toContainText('2 ürün');
  await bolum(page, 'Eşleşme Merkezi');
  await bolum(page, 'Onayla: YAPAY TAKMA');
  await hazir(page);
  await expect(page.getByLabel('Stok eşleştirmeleri')).toContainText('Onaylı');
  await bolum(page, 'Analiz');
  await expect(page.getByRole('note')).toContainText('1 ürün');
  await bolum(page, 'Eşleşme Merkezi');
  await bolum(page, 'Kaldır: YAPAY TAKMA');
  await hazir(page);
  await expect(page.getByText('Henüz elle eşleştirme yok.', { exact: true })).toBeVisible();
  await bolum(page, 'Son eşleştirme değişikliğini geri al');
  await hazir(page);
  await expect(page.getByLabel('Stok eşleştirmeleri')).toContainText('Onaylı');
  await page.reload();
  await yukle(page);
  await bolum(page, 'Eşleşme Merkezi');
  await expect(page.getByLabel('Stok eşleştirmeleri')).toContainText('Onaylı');
});
test('Kârlılık: iki dönem kaydı, gerçek değişimler, silme/geri alma ve yenileme korunur', async ({
  page,
}) => {
  await page.goto(ADRES);
  await yukle(page);
  await bolum(page, 'Dönem Analizi');
  await page.getByLabel('Dönem adı', { exact: true }).fill('Yapay İlk');
  await bolum(page, 'Analizi dönem olarak kaydet');
  await hazir(page);
  await expect(page.getByLabel('Kayıtlı kârlılık dönemleri')).toContainText('Yapay İlk');
  await bolum(page, 'Analiz');
  await yukle(page, 4);
  await bolum(page, 'Dönem Analizi');
  await page.getByLabel('Dönem adı', { exact: true }).fill('Yapay İkinci');
  await bolum(page, 'Analizi dönem olarak kaydet');
  await hazir(page);
  const options = await page
    .getByLabel('İlk dönem', { exact: true })
    .locator('option')
    .evaluateAll((es) => es.slice(1).map((e) => (e as HTMLOptionElement).value));
  await page.getByLabel('İlk dönem', { exact: true }).selectOption(options[0] ?? '');
  await page.getByLabel('İkinci dönem', { exact: true }).selectOption(options[1] ?? '');
  await bolum(page, 'Dönemleri karşılaştır');
  await expect(page.getByRole('table', { name: 'Dönem karşılaştırması' })).toBeVisible({ timeout: 30_000 });
  const delta = referans.karsilastirma.metrics[0]?.delta.toLocaleString('tr', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  await expect(page.getByRole('table', { name: 'Dönem karşılaştırması' })).toContainText(delta ?? '');
  await bolum(page, 'Sil: Yapay İlk');
  await hazir(page);
  await expect(page.getByRole('button', { name: 'Sil: Yapay İlk', exact: true })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Dönem karşılaştırması' })).toHaveCount(0);
  await bolum(page, 'Son dönem değişikliğini geri al');
  await hazir(page);
  await expect(page.getByRole('button', { name: 'Sil: Yapay İlk', exact: true })).toBeVisible();
  await page.reload();
  await bolum(page, 'Dönem Analizi');
  // Bölüm açılınca kayıtlar düğmeye basmadan okunur
  await hazir(page);
  await expect(page.getByLabel('Kayıtlı kârlılık dönemleri')).toContainText('Yapay İlk');
  await bolum(page, 'Kayıtları yenile');
  await hazir(page);
  await expect(page.getByLabel('Kayıtlı kârlılık dönemleri')).toContainText('Yapay İlk');
});
test('Kârlılık: sayfalama bütün görünür Excel kapsamını korur; dosya değişimi ve rota', async ({ page }) => {
  await page.goto(ADRES);
  await yukle(page, 8);
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu' }).locator('tbody tr')).toHaveCount(
    50,
  );
  await bolum(page, 'Sonraki');
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu' }).locator('tbody tr')).toHaveCount(
    15,
  );
  expect((await excel(await indir(page, 'Görünenleri Excel’e aktar (65)'))).worksheets[0]?.rowCount).toBe(66);
  await page.getByRole('link', { name: 'Müşteri Takip', exact: true }).click();
  await page.getByRole('link', { name: 'Kârlılık Analizi', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu' })).toBeVisible();
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  await page.getByLabel('Kârlılık satış raporu', { exact: true }).setInputFiles({
    name: 'Yapay değişti.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(s.girdiler.satis, 'base64'),
  });
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Analiz et', exact: true })).toBeDisabled();
});
test('Kârlılık: bozuk dosya ve bozuk yerel kayıt sonuç üretmez; kayıt ezilmez', async ({ page }) => {
  await page.goto(ADRES);
  await page.getByLabel('Kârlılık satış raporu', { exact: true }).setInputFiles({
    name: 'Yapay bozuk.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('bozuk'),
  });
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  await page.getByLabel('Kârlılık fiyat raporu', { exact: true }).setInputFiles({
    name: 'Yapay fiyat.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(s.girdiler.fiyat, 'base64'),
  });
  await bolum(page, 'Analiz et');
  await expect(page.getByRole('alert')).toContainText('içeriği');
  await page.evaluate(
    () =>
      new Promise<void>((coz, reddet) => {
        const r = indexedDB.open('bup-rapor', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => {
          const tx = r.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ surum: 999 }, 'satis:karlilik:v1');
          tx.oncomplete = () => {
            r.result.close();
            coz();
          };
          tx.onerror = () => reddet(tx.error);
        };
      }),
  );
  await bolum(page, 'Dönem Analizi');
  await bolum(page, 'Kayıtları yenile');
  await expect(page.getByRole('alert')).toContainText('Önceki kayıt korunuyor');
  const stored = await page.evaluate(
    () =>
      new Promise<unknown>((coz) => {
        const r = indexedDB.open('bup-rapor', 1);
        r.onsuccess = () => {
          const tx = r.result.transaction('kv', 'readonly'),
            q = tx.objectStore('kv').get('satis:karlilik:v1');
          q.onsuccess = () => coz(q.result);
          tx.oncomplete = () => r.result.close();
        };
      }),
  );
  expect(stored).toEqual({ surum: 999 });
});
test('Kârlılık: iptal/rota çıkışı işçiyi kapatır; geç yanıt uygulanmaz', async ({ page }) => {
  await page.addInitScript(() => {
    class Bekleyen {
      onmessage = null;
      onerror = null;
      postMessage() {
        Reflect.set(globalThis, 'calKarlilikBasladi', true);
      }
      terminate() {
        Reflect.set(globalThis, 'calKarlilikKapandi', true);
      }
    }
    Reflect.set(globalThis, 'Worker', Bekleyen);
  });
  await page.goto(ADRES);
  const s = referans.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  for (const [tur, label] of [
    ['satis', 'Kârlılık satış raporu'],
    ['fiyat', 'Kârlılık fiyat raporu'],
  ] as const)
    await page.getByLabel(label, { exact: true }).setInputFiles({
      name: `Yapay ${tur}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(s.girdiler[tur], 'base64'),
    });
  await bolum(page, 'Analiz et');
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'calKarlilikBasladi'))).toBe(true);
  await bolum(page, 'İşlemi durdur');
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'calKarlilikKapandi'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Analiz et', exact: true })).toBeEnabled();
  await page.evaluate(() => Reflect.set(globalThis, 'calKarlilikKapandi', false));
  await bolum(page, 'Analiz et');
  await expect(page.getByRole('button', { name: 'İşlemi durdur', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Müşteri Takip', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'calKarlilikKapandi'))).toBe(true);
});
for (const tema of ['acik', 'koyu'])
  test(`Kârlılık ${tema}: klavye, açık/koyu ve dar ekranda taşma yok`, async ({ page }) => {
    const hatalar: string[] = [];
    page.on('pageerror', (e) => hatalar.push(e.message));
    await page.addInitScript((t) => localStorage.setItem('bup-rapor:tema', t), tema);
    await page.goto(ADRES);
    await expect(page.locator('html')).toHaveAttribute('data-theme', tema === 'koyu' ? 'dark' : 'light');
    await yukle(page);
    await page.getByRole('button', { name: 'Bildirimi kapat', exact: true }).click();
    await page.getByLabel('Stok ara', { exact: true }).focus();
    await page.keyboard.type('Alfa');
    await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu' }).locator('tbody tr')).toHaveCount(
      2,
    );
    await page.screenshot({ path: join(tmpdir(), `cal-karlilik-${tema}.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: join(tmpdir(), `cal-karlilik-${tema}-dar.png`), fullPage: true });
    for (const b of ['Genel Bakış', 'Senaryo', 'Eşleşme Merkezi', 'Dönem Analizi']) {
      await bolum(page, b);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({
        path: join(tmpdir(), `cal-karlilik-${tema}-${b.replaceAll(' ', '-')}-dar.png`),
        fullPage: true,
      });
    }
    expect(hatalar).toEqual([]);
  });

test('Kârlılık: başka sekmede onaylanan eşleşme eski görünür çıktıya uygulanmaz', async ({
  page,
  context,
}) => {
  await page.goto(ADRES);
  await yukle(page);
  const diger = await context.newPage();
  await diger.goto(ADRES);
  await yukle(diger);
  await bolum(diger, 'Eşleşme Merkezi');
  await diger.getByLabel('Eşleşmeyen satış stoğu', { exact: true }).selectOption('YAPAY TAKMA');
  await diger.getByLabel('Fiyat stoğu', { exact: true }).selectOption('YAPAY ALFA');
  await bolum(diger, 'Eşleştirme öner');
  await hazir(diger);
  await bolum(diger, 'Onayla: YAPAY TAKMA');
  await hazir(diger);
  const indirmeler: Download[] = [];
  page.on('download', (d) => indirmeler.push(d));
  await bolum(page, 'Excel’e aktar');
  await expect(page.getByRole('alert')).toContainText('başka sekmede', { timeout: 30_000 });
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu' })).toHaveCount(0);
  expect(indirmeler).toEqual([]);
  await bolum(page, 'Analiz et');
  await expect(page.getByRole('table', { name: 'Kârlılık sonuç tablosu' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('note')).toContainText('1 ürün');
});
