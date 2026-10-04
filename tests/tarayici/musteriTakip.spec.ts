import { test, expect, type Page, type Download } from '@playwright/test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ADRES = '/CAL_bup/#/satis/musteri-takip';

async function yapayExcel(adlar: readonly string[], depo = 'İZMİR ARAÇ 06') {
  const w = new ExcelJS.Workbook();
  const s = w.addWorksheet('Yapay');
  s.addRow(['Yapay müşteri raporu']);
  s.addRow([`Cari Kategori 3 [YAPAY] ${depo}`]);
  s.addRow(['Kod', 'Cari Ünvan']);
  adlar.forEach((ad) => s.addRow(['YAPAY', ad]));
  return Buffer.from(await w.xlsx.writeBuffer());
}

async function listeSec(page: Page, yon: 'Eski' | 'Yeni', adlar: readonly string[], depo?: string) {
  await page.getByLabel(`${yon} tarihli Excel`, { exact: true }).setInputFiles({
    name: `Yapay ${yon}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await yapayExcel(adlar, depo),
  });
}

async function karsilastir(page: Page) {
  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Karşılaştırma sonucu', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Karşılaştır', exact: true })).toBeEnabled();
}

async function excelOku(indirme: Download) {
  const dosya = await indirme.path();
  if (!dosya) throw new Error('Yapay indirme tamamlanmadı.');
  const w = new ExcelJS.Workbook();
  await w.xlsx.load((await readFile(dosya)) as unknown as ExcelJS.Buffer);
  return w;
}

test('Satış altında iki yön, tekrarlar, sayfalama ve tam/görünen çıktı kapsamı korunur', async ({
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
    .getByRole('link', { name: 'Müşteri Takip', exact: true })
    .click();
  const eksikler = Array.from({ length: 120 }, (_, i) => `Yapay Beta ${String(i).padStart(3, '0')}`);
  await listeSec(page, 'Eski', ['Yapay Alfa', ...eksikler, 'yapay alfa']);
  await listeSec(page, 'Yeni', ['YAPAY ALFA', 'Yapay Gamma', 'Yapay Yeni']);
  await karsilastir(page);
  await expect(
    page.getByText('Toplam 122 cari ünvandan 120 tanesi yeni dosyada bulunmuyor.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Eksik müşteriler', exact: true }).locator('tbody tr'),
  ).toHaveCount(50);
  await page.getByLabel('Cari ara', { exact: true }).fill('Beta 119');
  const tamIndirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksikleri Excel’e aktar', exact: true }).click();
  const tam = await excelOku(await tamIndirme);
  expect(tam.worksheets[0]?.name).toBe('Sheet1');
  expect(tam.worksheets[0]?.rowCount).toBe(123);
  expect(tam.worksheets[0]?.getCell('B123').value).toBe('Yapay Beta 119');
  const gorunenIndirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Görünenleri Excel’e aktar (1)', exact: true }).click();
  const gorunen = await excelOku(await gorunenIndirme);
  expect(gorunen.worksheets.map((s) => s.name)).toEqual(['Görünen Satırlar', 'Kapsam']);
  expect(gorunen.worksheets[0]?.getCell('B2').value).toBe('Yapay Beta 119');
  await page.getByLabel('Cari ara', { exact: true }).fill('');
  const tumGorunenIndirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Görünenleri Excel’e aktar (120)', exact: true }).click();
  expect((await excelOku(await tumGorunenIndirme)).worksheets[0]?.rowCount).toBe(121);
  await page.getByRole('button', { name: 'Yeni Müşteriler 2', exact: true }).click();
  await page.getByLabel('Sıralama', { exact: true }).selectOption('za');
  const yeniIndirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Görünenleri Excel’e aktar (2)', exact: true }).click();
  const yeni = await excelOku(await yeniIndirme);
  expect(yeni.worksheets[0]?.getCell('B2').value).toBe('Yapay Yeni');
  expect(yeni.worksheets[1]?.getCell('B4').value).toBe('Yeni Müşteriler');
  expect(disIstekler).toEqual([]);
});

test('harf seçeneği ve dosya değişikliği eski sonucu geçersiz kılar; temizleme tamdır', async ({ page }) => {
  await page.goto(ADRES);
  await listeSec(page, 'Eski', ['Yapay Alfa', 'Yapay Beta']);
  await listeSec(page, 'Yeni', ['yapay alfa']);
  await karsilastir(page);
  await page.getByLabel('Büyük/küçük harf duyarlı karşılaştırma', { exact: true }).check();
  await expect(page.getByRole('button', { name: 'Eksikleri Excel’e aktar', exact: true })).toHaveCount(0);
  await karsilastir(page);
  await expect(
    page.getByRole('table', { name: 'Eksik müşteriler', exact: true }).locator('tbody tr'),
  ).toHaveCount(2);
  await listeSec(page, 'Yeni', ['Yapay Alfa']);
  await expect(page.getByRole('heading', { name: 'Karşılaştırma sonucu', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Temizle', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Karşılaştır', exact: true })).toBeDisabled();
  await expect(page.getByText('Dosya seçilmedi', { exact: true })).toHaveCount(2);
});

test('bozuk dosya başarısız olur; düzeltilen dosyayla uygulama çalışmayı sürdürür', async ({ page }) => {
  await page.goto(ADRES);
  await page.getByLabel('Eski tarihli Excel', { exact: true }).setInputFiles({
    name: 'Yapay bozuk.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('yapay'),
  });
  await listeSec(page, 'Yeni', ['Yapay Alfa']);
  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect(page.locator('#musteri-islem-hatasi')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Karşılaştırma sonucu', exact: true })).toHaveCount(0);
  await listeSec(page, 'Eski', ['Yapay Alfa', 'Yapay Beta']);
  await expect(page.locator('#musteri-islem-hatasi')).toHaveCount(0);
  await karsilastir(page);
});

test('bekleyen dosya okuması durdurulur, geç sonuç gelmez ve çift işlem açılamaz', async ({ page }) => {
  await page.goto(ADRES);
  await listeSec(page, 'Eski', ['Yapay Alfa']);
  await listeSec(page, 'Yeni', []);
  await page.evaluate(() => {
    const asil = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      const okuma = asil.call(this);
      return new Promise((coz) => {
        Reflect.set(globalThis, 'yapayMusteriOkumayiBitir', async () => {
          File.prototype.arrayBuffer = asil;
          coz(await okuma);
        });
      });
    };
  });
  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect(page.getByLabel('Yeni tarihli Excel', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Karşılaştır', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'İşlemi durdur', exact: true }).click();
  await page.evaluate(() => Reflect.get(globalThis, 'yapayMusteriOkumayiBitir')());
  await expect(page.getByRole('button', { name: 'Karşılaştır', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Karşılaştırma sonucu', exact: true })).toHaveCount(0);
  await karsilastir(page);
});

test('rota değişimi dosyaları ve sonucu korur; yenileme müşteri verisini kalıcılaştırmaz', async ({
  page,
}) => {
  await page.goto(ADRES);
  await listeSec(page, 'Eski', ['Yapay Alfa', 'Yapay Beta']);
  await listeSec(page, 'Yeni', ['Yapay Alfa']);
  await karsilastir(page);
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  await expect(page.getByText('Müşteri listeleri karşılaştırıldı.', { exact: true })).not.toBeVisible();
  await page.getByRole('link', { name: 'Müşteri Takip', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Eksik müşteriler', exact: true })).toContainText(
    'Yapay Beta',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Karşılaştır', exact: true })).toBeDisabled();
  await expect(page.getByText('Dosya seçilmedi', { exact: true })).toHaveCount(2);
});

test('bekleyen işçi rota değişiminde kapatılır; gizli ekran geç sonuç yayımlamaz', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(
      globalThis,
      'Worker',
      class {
        onmessage = null;
        onerror = null;
        postMessage() {
          Reflect.set(globalThis, 'yapayIsciBasladi', true);
        }
        terminate() {
          Reflect.set(globalThis, 'yapayIsciKapandi', true);
        }
      },
    );
  });
  await page.goto(ADRES);
  await listeSec(page, 'Eski', ['Yapay Alfa']);
  await listeSec(page, 'Yeni', []);
  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'yapayIsciBasladi'))).toBe(true);
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(globalThis, 'yapayIsciKapandi'))).toBe(true);
  await page.getByRole('link', { name: 'Müşteri Takip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Karşılaştır', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Karşılaştırma sonucu', exact: true })).toHaveCount(0);
});

test('işçi başlatma arızası anlaşılır hata verir; yarım sonuç oluşturmaz', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.set(globalThis, 'Worker', function YapayArizaliWorker() {
      throw new Error('Yapay işçi arızası');
    });
  });
  await page.goto(ADRES);
  await listeSec(page, 'Eski', ['Yapay Alfa']);
  await listeSec(page, 'Yeni', []);
  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect(page.locator('#musteri-islem-hatasi')).toBeVisible();
  await expect(page.locator('#musteri-islem-hatasi')).not.toContainText('Yapay işçi arızası');
  await expect(page.getByRole('heading', { name: 'Karşılaştırma sonucu', exact: true })).toHaveCount(0);
});

test('araç/plasiyer kayıt ve geri alma çıktıya yansır; yenilemede ayar korunur', async ({ page }) => {
  await page.goto(ADRES);
  await page.getByRole('button', { name: 'Araç/plasiyer ayarları', exact: true }).click();
  await page.getByRole('button', { name: 'Satır ekle', exact: true }).click();
  await page.getByLabel('Araç 1', { exact: true }).fill('06');
  await page.getByLabel('Plasiyer 1', { exact: true }).fill('Yapay Plasiyer');
  await page.getByRole('button', { name: 'Ayarları kaydet', exact: true }).click();
  await expect(page.getByText('Araç/plasiyer ayarları kaydedildi.', { exact: true })).toBeVisible();
  await page.getByLabel('Plasiyer 1', { exact: true }).fill('Yapay İkinci');
  await page.getByRole('button', { name: 'Ayarları kaydet', exact: true }).click();
  await expect(page.getByLabel('Plasiyer 1', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Son değişikliği geri al', exact: true }).click();
  await expect(page.getByLabel('Plasiyer 1', { exact: true })).toHaveValue('Yapay Plasiyer');
  await page.reload();
  await page.getByRole('button', { name: 'Araç/plasiyer ayarları', exact: true }).click();
  await expect(page.getByLabel('Plasiyer 1', { exact: true })).toHaveValue('Yapay Plasiyer');
  await listeSec(page, 'Eski', ['=Yapay Formül', 'Yapay Normal']);
  await listeSec(page, 'Yeni', []);
  await karsilastir(page);
  const indirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksikleri Excel’e aktar', exact: true }).click();
  const d = await indirme;
  expect(d.suggestedFilename()).toBe('Arac_06_Yapay Plasiyer.xlsx');
  const w = await excelOku(d);
  expect(w.worksheets[0]?.getCell('A1').value).toBe('Araç 06 - Yapay Plasiyer');
  expect(w.worksheets[0]?.getCell('B4').value).toBe("'=Yapay Formül");
});

test('başka sekmede değişen araç ayarı sessizce ezilmez', async ({ page, context }) => {
  const diger = await context.newPage();
  for (const p of [page, diger]) {
    await p.goto(ADRES);
    await p.getByRole('button', { name: 'Araç/plasiyer ayarları', exact: true }).click();
    await p.getByRole('button', { name: 'Satır ekle', exact: true }).click();
    await p.getByLabel('Araç 1', { exact: true }).fill('06');
  }
  await page.getByLabel('Plasiyer 1', { exact: true }).fill('Yapay Birinci');
  await page.getByRole('button', { name: 'Ayarları kaydet', exact: true }).click();
  await expect(page.getByText('Araç/plasiyer ayarları kaydedildi.', { exact: true })).toBeVisible();
  await diger.getByLabel('Plasiyer 1', { exact: true }).fill('Yapay Eski Sekme');
  await diger.getByRole('button', { name: 'Ayarları kaydet', exact: true }).click();
  await expect(diger.locator('#plasiyer-ayar-hatasi')).toContainText('başka sekmede');
  await diger.getByRole('button', { name: 'Araç/plasiyer ayarları', exact: true }).click();
  await expect(diger.getByLabel('Plasiyer 1', { exact: true })).toHaveValue('Yapay Birinci');
});

test('bozuk kalıcı ayar boş sayılıp üzerine kaydedilmez', async ({ page }) => {
  await page.goto(ADRES);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((coz, reddet) => {
      const r = indexedDB.open('bup-rapor', 1);
      r.onsuccess = () => coz(r.result);
      r.onerror = () => reddet(r.error);
    });
    await new Promise<void>((coz, reddet) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put({ surum: 99, veri: 'Yapay Bozuk' }, 'satis:musteri-plasiyer:v1');
      t.oncomplete = () => coz();
      t.onerror = () => reddet(t.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('#plasiyer-okuma-hatasi')).toBeVisible();
  await page.getByRole('button', { name: 'Araç/plasiyer ayarları', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ayarları kaydet', exact: true })).toBeDisabled();
});

test('PNG boş liste ve çok sayfalı listede oluşturulur', async ({ page }) => {
  await page.goto(ADRES);
  await listeSec(page, 'Eski', []);
  await listeSec(page, 'Yeni', []);
  await karsilastir(page);
  const bosIndirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksikleri resme aktar', exact: true }).click();
  const bos = await bosIndirme;
  const dosya = await bos.path();
  expect(dosya).toBeTruthy();
  if (!dosya) throw new Error('Yapay resim indirilmedi.');
  const png = await readFile(dosya);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(1440);
  await listeSec(
    page,
    'Eski',
    Array.from({ length: 201 }, (_, i) => `Yapay Müşteri ${i}`),
  );
  await karsilastir(page);
  const zipIndirme = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksikleri resme aktar', exact: true }).click();
  const d = await zipIndirme;
  expect(d.suggestedFilename()).toBe('İZMİR ARAÇ 06_resimler.zip');
  const zipYolu = await d.path();
  if (!zipYolu) throw new Error('Yapay resim ZIP indirilmedi.');
  const zip = await JSZip.loadAsync(await readFile(zipYolu));
  expect(Object.keys(zip.files)).toEqual(['İZMİR ARAÇ 06_1.png', 'İZMİR ARAÇ 06_2.png']);
  const son = await zip.file('İZMİR ARAÇ 06_2.png')?.async('nodebuffer');
  expect(son?.readUInt32BE(20)).toBe(190);
});

for (const tema of ['acik', 'koyu'] as const) {
  test(`Müşteri Takip ${tema}: masaüstü/dar ekran, klavye ve görsel kabul`, async ({ page }) => {
    const hatalar: string[] = [];
    page.on('pageerror', (e) => hatalar.push(e.message));
    await page.addInitScript((tema) => localStorage.setItem('bup-rapor:tema', tema), tema);
    await page.goto(ADRES);
    await listeSec(page, 'Eski', ['Yapay Alfa', 'Yapay Beta', 'Yapay Çok Uzun Müşteri Ünvanı '.repeat(6)]);
    await listeSec(page, 'Yeni', ['Yapay Alfa', 'Yapay Yeni']);
    await page.getByRole('button', { name: 'Karşılaştır', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('table', { name: 'Eksik müşteriler', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Bildirimi kapat', exact: true }).click();
    await page.screenshot({ path: join(tmpdir(), `cal-musteri-${tema}.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: join(tmpdir(), `cal-musteri-${tema}-dar.png`), fullPage: true });
    expect(hatalar).toEqual([]);
  });
}
