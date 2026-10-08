import { test, expect } from '@playwright/test';
import { cariHazirla, kartDoldur, posKilidiniAc, yapayFoto } from './yardimci';

test('kart doğrulama ve yinelenen kayıt hatası modal içinde, görünür ve odaklıdır', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page.locator('dialog form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  const hata = page.locator('dialog [role=alert]');
  await expect(hata).toBeInViewport();
  await expect(hata).toBeFocused();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape');
  await kartDoldur(page);
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  const bilgi = page.locator('.bildirim').filter({ hasText: 'Kart bu carinin' });
  await expect(bilgi).toBeInViewport();
  await kartDoldur(page, 'Yapay Yinelenen');
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(hata).toContainText('zaten kayıtlı');
  await expect(hata).toBeInViewport();
  await expect(hata).toBeFocused();
  expect(
    await hata.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return e.contains(document.elementFromPoint(r.x + 5, r.y + 5));
    }),
  ).toBe(true);
});

test('depo yazısı engellenince profil kapanır, hata görünür ve başarı gösterilmez', async ({ page }) => {
  await cariHazirla(page);
  await kartDoldur(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Yapay ret', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('sonucu doğrulanamadı');
  await expect(page.getByRole('alert')).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Profil durumunu yeniden kontrol et', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.bildirim').filter({ hasText: 'Kart bu carinin' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.reload();
  await posKilidiniAc(page);
  await page.locator('.pos-cari').click();
  await expect(page.locator('.pos-odeme-karti')).toHaveCount(0);
});

test('geçersiz ayar taslağı açıklanır, engellenen kalıcı kayıtta oturum uyarısı görünür', async ({
  page,
}) => {
  await page.goto('/CAL_bup/#/ayarlar');
  await page.locator('#tolerans').fill('abc');
  await page.locator('#tolerans').blur();
  await expect(page.locator('#tolerans')).toHaveValue('abc');
  await expect(page.locator('#tolerans')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('Önceki ayar korundu');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Yapay ret', 'QuotaExceededError');
    };
  });
  await page.locator('#tolerans').fill('0,02');
  await page.locator('#tolerans').blur();
  await expect(page.locator('.bildirim')).toContainText('yalnızca bu oturumda');
  await expect(page.locator('.bildirim')).toBeInViewport();
  await page.reload();
  await expect(page.locator('#tolerans')).toHaveValue('0,001');
});

test('geçmiş deposu okunamadığında boş geçmiş denmez ve yeniden deneme vardır', async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException('Yapay ret', 'SecurityError');
    };
  });
  await page.goto('/CAL_bup/#/gecmis');
  await expect(page.getByRole('alert')).toContainText('Geçmiş ve yedekler açılamadı');
  await expect(page.getByText('Henüz kayıt yok', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Henüz yedek yok.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Yeniden dene', exact: true })).toBeEnabled();
});

test('listelenen yedeğin baytları eksikse sessizce durmaz', async ({ page }) => {
  await page.goto('/CAL_bup/#/gecmis');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((coz) => {
      const r = indexedDB.open('bup-rapor', 1);
      r.onsuccess = () => coz(r.result);
    });
    await new Promise<void>((coz) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(
        [{ id: 'yapay-eksik', zaman: new Date().toISOString(), dosyaAdi: 'Yapay.xlsx' }],
        'yedekler',
      );
      t.oncomplete = () => coz();
    });
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: 'İndir', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Yedeğin dosya içeriği bulunamadı');
  await expect(page.getByRole('alert')).toBeInViewport();
});

for (const tur of ['404', 'iptal', 'sure'] as const)
  test(`OCR modeli ${tur}: görünen sonuç ve sıfır kalan worker`, async ({ page, context }) => {
    let model = false;
    await context.route('**/ocr/eng.traineddata.gz', (r) => {
      model = true;
      return tur === '404' ? r.fulfill({ status: 404, body: 'yapay' }) : new Promise(() => undefined);
    });
    await cariHazirla(page);
    await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
    if (tur === 'sure') await page.clock.install();
    await page
      .getByLabel('Kart fotoğrafından numara ve tarih oku')
      .setInputFiles({ name: 'yapay.png', mimeType: 'image/png', buffer: await yapayFoto(page) });
    await expect.poll(() => model).toBe(true);
    if (tur === 'iptal') await page.getByRole('button', { name: 'Okumayı durdur', exact: true }).click();
    if (tur === 'sure') await page.clock.fastForward(91_000);
    await expect(page.getByRole('button', { name: 'Okumayı durdur', exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toContainText(
      tur === '404' ? 'yüklenemedi' : tur === 'sure' ? 'süresi doldu' : 'durduruldu',
    );
    await expect.poll(() => page.workers().length).toBe(0);
  });
