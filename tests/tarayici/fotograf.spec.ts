import { test, expect } from '@playwright/test';
import { cariHazirla, yapayFoto } from './yardimci';
import { fotoUret, type FotoVaka } from './fotografYardimci';
const vakalar: FotoVaka[] = [
  { ad: 'düz PNG' },
  { ad: 'düz JPG', mime: 'image/jpeg' },
  { ad: 'düz WebP', mime: 'image/webp' },
  { ad: '90 derece', donus: 90 },
  { ad: '180 derece', donus: 180 },
  { ad: '270 derece', donus: 270 },
  { ad: '12 derece eğik', egim: 12 },
  { ad: 'bulanık', blur: 3 },
  { ad: 'düşük kontrast', fg: '#bbb', bg: '#aaa' },
  { ad: 'koyu kart', fg: '#eee', bg: '#13223d' },
  { ad: 'uzak kart', uzak: true },
  { ad: 'iki tarih', ikiTarih: true },
  { ad: 'bölünmüş PAN', bol: true },
  { ad: 'küçük rakam', font: 24 },
  { ad: 'sayısal dekor', dekor: true },
  { ad: 'PAN ve tarih aynı satır', ayniSatir: true },
  { ad: 'etiketli bitişik tarih', bitisikTarih: true },
];
for (const v of vakalar)
  test('gerçek OCR matrisi: ' + v.ad, async ({ page }) => {
    await cariHazirla(page);
    await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
    await page
      .getByLabel('Kart fotoğrafından numara ve tarih oku')
      .setInputFiles({ name: 'yapay.png', mimeType: v.mime ?? 'image/png', buffer: await fotoUret(page, v) });
    await expect(page.getByRole('heading', { name: 'Fotoğraftan bulunan alanlar', exact: true })).toBeVisible(
      { timeout: 60_000 },
    );
    await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Bulunan kart numarası')).toHaveValue('4242424242424242');
    await expect(page.getByLabel('Bulunan son kullanma tarihi').locator('option')).toHaveCount(
      v.ikiTarih ? 3 : 2,
    );
    if (v.ikiTarih) {
      await expect(page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula' })).toBeDisabled();
      await page.getByLabel('Bulunan son kullanma tarihi').selectOption('12/2035');
    } else await expect(page.getByLabel('Bulunan son kullanma tarihi')).toHaveValue('12/2035');
    await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
    await page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }).click();
    await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('4242424242424242');
    await expect(page.getByLabel('Son kullanma ayı', { exact: true })).toHaveValue('12');
    await expect(page.getByLabel('Son kullanma yılı', { exact: true })).toHaveValue('2035');
    await expect.poll(() => page.workers().length).toBe(0);
  });

test('boş fotoğraf eski alanları değiştirmez; kısmi aday uygulaması eski tarih ile karışmaz', async ({
  page,
}) => {
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page.getByLabel('Kart numarası', { exact: true }).fill('5555555555554444');
  await page.getByLabel('Son kullanma ayı', { exact: true }).selectOption('10');
  await page.getByLabel('Son kullanma yılı', { exact: true }).selectOption('2034');
  const girdi = page.getByLabel('Kart fotoğrafından numara ve tarih oku');
  await girdi.setInputFiles({
    name: 'yapay-bos.png',
    mimeType: 'image/png',
    buffer: await yapayFoto(page, true),
  });
  await expect(page.getByRole('dialog')).toContainText('Numara veya tarih okunamadı', { timeout: 60_000 });
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('5555555555554444');
  await girdi.setInputFiles({
    name: 'yapay-kismi.png',
    mimeType: 'image/png',
    buffer: await fotoUret(page, { ad: 'kısmi', tarihsiz: true }),
  });
  await expect(page.getByLabel('Bulunan kart numarası')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel('Son kullanma yılı', { exact: true })).toHaveValue('2034');
  await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
  await page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }).click();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('4242424242424242');
  await expect(page.getByLabel('Son kullanma ayı', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Son kullanma yılı', { exact: true })).toHaveValue('');
});

test('yalnız tarih okunursa elle yazılan kart numarası korunur', async ({ page }) => {
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page.getByLabel('Kart numarası', { exact: true }).fill('5555555555554444');
  await page.getByLabel('Kart fotoğrafından numara ve tarih oku').setInputFiles({
    name: 'yapay-tarih.png',
    mimeType: 'image/png',
    buffer: await fotoUret(page, { ad: 'yalnız tarih', numara: 'YAPAY KART' }),
  });
  await expect(page.getByLabel('Bulunan son kullanma tarihi')).toHaveValue('12/2035', { timeout: 60_000 });
  await expect(page.getByRole('dialog')).toContainText('formdaki kart numarası korunur');
  await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
  await page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }).click();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('5555555555554444');
  await expect(page.getByLabel('Son kullanma ayı', { exact: true })).toHaveValue('12');
  await expect(page.getByLabel('Son kullanma yılı', { exact: true })).toHaveValue('2035');
});

test('elle değişiklik eski adayları kaldırır; fotoğraf kaldırılınca URL serbest bırakılır', async ({
  page,
}) => {
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page
    .getByLabel('Kart fotoğrafından numara ve tarih oku')
    .setInputFiles({ name: 'yapay.png', mimeType: 'image/png', buffer: await yapayFoto(page) });
  await expect(page.getByLabel('Bulunan kart numarası')).toBeVisible({ timeout: 60_000 });
  const url = await page.getByAltText('Seçilen kart fotoğrafının geçici önizlemesi').getAttribute('src');
  await page.getByLabel('Kart numarası', { exact: true }).fill('5555555555554444');
  await expect(page.getByLabel('Bulunan kart numarası')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('önceki fotoğraf adayları kaldırıldı');
  await page.getByRole('button', { name: 'Fotoğrafı kaldır', exact: true }).click();
  await expect(page.getByAltText('Seçilen kart fotoğrafının geçici önizlemesi')).toHaveCount(0);
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
});

test('önizleme döndürme/kırpma ve yeniden okuma kullanıcı onayına bağlıdır', async ({ page }) => {
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page
    .getByLabel('Kart fotoğrafından numara ve tarih oku')
    .setInputFiles({ name: 'yapay.png', mimeType: 'image/png', buffer: await yapayFoto(page) });
  await expect(page.getByLabel('Bulunan kart numarası')).toBeVisible({ timeout: 60_000 });
  await page.getByText('Fotoğrafı döndür veya kırp', { exact: true }).click();
  await page.getByRole('button', { name: '90° döndür', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Önizleme güncellendi');
  await page.getByLabel('Soldan kes (%)', { exact: true }).fill('2');
  await page.getByLabel('Soldan kes (%)', { exact: true }).blur();
  await expect(page.getByLabel('Genişlik (%)', { exact: true })).toHaveValue('98');
  await page.getByRole('button', { name: 'Fotoğrafı yeniden oku', exact: true }).click();
  await expect(page.getByLabel('Bulunan kart numarası')).toHaveValue('4242424242424242', { timeout: 60_000 });
  await expect(page.getByLabel('Bulunan son kullanma tarihi')).toHaveValue('12/2035');
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('');
  await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
  await page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }).click();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('4242424242424242');
});
