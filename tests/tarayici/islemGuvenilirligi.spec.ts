import { test, expect } from '@playwright/test';
import { cariHazirla, yapayFoto } from './yardimci';
for (const dosya of ['worker.min.js', '*.wasm*'])
  test(`OCR bileşeni eksik: ${dosya}, hata ve kaynak temizliği`, async ({ page, context }) => {
    await context.route(`**/ocr/${dosya}`, (r) => r.fulfill({ status: 404, body: 'yapay eksik' }));
    await cariHazirla(page);
    await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
    await page
      .getByLabel('Kart fotoğrafından numara ve tarih oku')
      .setInputFiles({ name: 'yapay.png', mimeType: 'image/png', buffer: await yapayFoto(page) });
    await expect(page.locator('dialog [role=alert]')).toContainText('Fotoğraf okuma', { timeout: 60_000 });
    await expect(page.locator('dialog [role=alert]')).toBeInViewport();
    await expect.poll(() => page.workers().length).toBe(0);
  });

test('rota değişimi fotoğraf işini ve geçici önizleme URL’sini kapatır', async ({ page, context }) => {
  let model = false;
  await context.route('**/ocr/eng.traineddata.gz', () => {
    model = true;
    return new Promise(() => undefined);
  });
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page
    .getByLabel('Kart fotoğrafından numara ve tarih oku')
    .setInputFiles({ name: 'yapay.png', mimeType: 'image/png', buffer: await yapayFoto(page) });
  await expect.poll(() => model).toBe(true);
  const url = await page.getByAltText('Seçilen kart fotoğrafının geçici önizlemesi').getAttribute('src');
  await page.evaluate(() => {
    location.hash = '#/ayarlar';
  });
  await expect(page.getByRole('heading', { name: 'Ayarlar', exact: true })).toBeVisible();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(
    await page.evaluate(async (u) => {
      try {
        await fetch(u ?? '');
        return true;
      } catch {
        return false;
      }
    }, url),
  ).toBe(false);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('sahte fotoğraf ve aşırı piksel motor çalıştırılmadan açıklanır', async ({ page }) => {
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  const g = page.getByLabel('Kart fotoğrafından numara ve tarih oku');
  await g.setInputFiles({
    name: 'yapay.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<svg>' + 'x'.repeat(40)),
  });
  await expect(page.locator('dialog [role=alert]')).toContainText('Geçerli bir JPG');
  expect(page.workers()).toHaveLength(0);
  const b = Buffer.alloc(32);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  b.write('IHDR', 12);
  b.writeUInt32BE(30000, 16);
  b.writeUInt32BE(1000, 20);
  await g.setInputFiles({ name: 'yapay.png', mimeType: 'image/png', buffer: b });
  await expect(page.locator('dialog [role=alert]')).toContainText('megapiksel');
  expect(page.workers()).toHaveLength(0);
});

test('React ekran hatası anlaşılır kurtarma ekranı gösterir; profil ve ham sırlar korunur', async ({
  page,
}) => {
  const gunluk: string[] = [];
  page.on('console', (m) => gunluk.push(m.text()));
  await cariHazirla(page);
  await page.evaluate(() => {
    String.prototype.toLocaleLowerCase = () => {
      throw new Error('Yapay ham sır 4242424242424242');
    };
  });
  await page.getByPlaceholder('Cari adı veya numarası…').fill('Yapay');
  await expect(page.getByRole('heading', { name: 'Ekran açılamadı' })).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText('4242');
  expect(gunluk.join(' ')).not.toContain('4242424242424242');
  await page.getByRole('button', { name: 'Uygulamayı yeniden aç' }).click();
  await expect(page.locator('.pos-cari')).toContainText('Yapay Denetim Carisi');
});

test('bozuk geçmiş boş listeye veya çöken ekrana dönüşmez; kayıt silinmez', async ({ page }) => {
  await page.goto('/CAL_bup/#/gecmis');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const a = indexedDB.open('bup-rapor', 1);
      a.onsuccess = () => r(a.result);
    });
    await new Promise<void>((r) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put({ yapay: 'bozuk' }, 'gecmis');
      t.oncomplete = () => r();
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Geçmiş ve yedekler açılamadı');
  await expect(page.getByRole('heading', { name: 'Henüz kayıt yok' })).toHaveCount(0);
});

test('reddedilen LED dosyası kendi bölümünde görünür ve odaklanır', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/CAL_bup/');
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles({
      name: 'Yapay.xlsx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('yapay bozuk excel'),
    });
  await expect(page.locator('#led-dosya-hata')).toContainText('dosya okunamadı');
  await expect(page.locator('#led-dosya-hata')).toBeInViewport();
  await expect(page.locator('#led-dosya-hata')).toBeFocused();
});

test('bozuk şifreli profil yedeği yerel hata verir, mevcut cari değiştirilmez', async ({ page }) => {
  await cariHazirla(page);
  await page.getByText('Şifreli yedekten kayıt ekle', { exact: true }).click();
  await page.getByLabel('Şifreli profil veya eski cari yedeği').setInputFiles({
    name: 'yapay.calpos',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('yapay bozuk yedek'),
  });
  await page.getByLabel('Yedeğin uzun parolası', { exact: true }).fill('yalnizca-yapay-yedek-parolasi');
  await page.getByRole('button', { name: 'Yedeği incele', exact: true }).click();
  await expect(page.locator('#islem-profil-yedek-inceleme-hata')).toContainText(
    'Geçerli bir şifreli profil yedeği',
  );
  await expect(page.locator('#islem-profil-yedek-inceleme-hata')).toBeInViewport();
  await expect(page.locator('.pos-cari')).toHaveCount(1);
});

test('geç biten pano işlemi farklı sayfaya başarı mesajı taşımaz', async ({ page }) => {
  await cariHazirla(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () =>
          new Promise<void>((r) => {
            Object.defineProperty(globalThis, 'yapayPanoBitir', { configurable: true, value: r });
          }),
      },
    });
  });
  await page.getByRole('button', { name: 'Numarayı kopyala', exact: true }).click();
  await page.getByRole('link', { name: 'Ayarlar', exact: true }).click();
  await page.evaluate(() => {
    const f = Reflect.get(globalThis, 'yapayPanoBitir');
    if (typeof f === 'function') f();
  });
  await expect(page.getByRole('heading', { name: 'Ayarlar', exact: true })).toBeVisible();
  await expect(page.locator('.bildirim').filter({ hasText: 'Numara kopyalandı' })).toHaveCount(0);
});
