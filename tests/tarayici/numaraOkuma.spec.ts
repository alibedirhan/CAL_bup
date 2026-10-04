import { test, expect } from '@playwright/test';
import { cariHazirla } from './yardimci';
for (const kip of ['kabartma', 'doku'] as const)
  test('numara odaklı gerçek OCR: ' + kip, async ({ page }) => {
    await cariHazirla(page);
    await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
    const png = await page.evaluate((kip) => {
      const c = document.createElement('canvas');
      c.width = 1500;
      c.height = 850;
      const x = c.getContext('2d');
      if (!x) throw new Error('Canvas yok');
      x.fillStyle = kip === 'doku' ? '#687a91' : '#d8dbe0';
      x.fillRect(0, 0, 1500, 850);
      if (kip === 'doku')
        for (let i = 0; i < 850; i += 8) {
          x.strokeStyle = i % 16 ? '#8491a6' : '#6d8299';
          x.beginPath();
          x.moveTo(0, i);
          x.lineTo(1500, i + 150);
          x.stroke();
        }
      x.font = '36px sans-serif';
      x.fillStyle = '#222';
      x.fillText('YAPAY TEST KARTI', 90, 110);
      x.font = '64px monospace';
      if (kip === 'kabartma') {
        x.fillStyle = '#f8f8f8';
        x.fillText('4242 4242 4242 4242', 93, 353);
        x.fillStyle = '#666';
        x.fillText('4242 4242 4242 4242', 87, 347);
        x.fillStyle = '#c9cbd0';
      } else x.fillStyle = '#eee';
      x.fillText('4242 4242 4242 4242', 90, 350);
      x.font = '40px monospace';
      x.fillStyle = '#111';
      x.fillText('VALID THRU 12/35', 800, 730);
      return c.toDataURL().split(',')[1] ?? '';
    }, kip);
    await page
      .getByLabel('Kart fotoğrafından numara ve tarih oku')
      .setInputFiles({ name: 'yapay-numara.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.getByLabel('Bulunan kart numarası')).toHaveValue('4242424242424242', {
      timeout: 60000,
    });
    await expect(page.getByLabel('Bulunan son kullanma tarihi')).toHaveValue('12/2035');
    await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
    await page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }).click();
    await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('4242424242424242');
    await expect(page.getByLabel('Kart numarası', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Son kullanma yılı', { exact: true })).toHaveValue('2035');
    await expect.poll(() => page.workers().length).toBe(0);
  });
test('yalnızca tarih okununca numara eksikliği açık; elle tamamlanan numara onayla aktarılır', async ({
  page,
}) => {
  await cariHazirla(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1500;
    c.height = 650;
    const x = c.getContext('2d');
    if (!x) throw new Error('Canvas yok');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#000';
    x.font = '64px monospace';
    x.fillText('VALID THRU 12/35', 90, 420);
    x.fillText('123', 1100, 530);
    return c.toDataURL().split(',')[1] ?? '';
  });
  await page
    .getByLabel('Kart fotoğrafından numara ve tarih oku')
    .setInputFiles({ name: 'yapay-kismi.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const tamamla = page.getByLabel('Okunamayan kart numarasını elle tamamla');
  await expect(tamamla).toBeVisible({ timeout: 60000 });
  await tamamla.fill('4242424242424241');
  await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
  await expect(
    page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }),
  ).toBeDisabled();
  await tamamla.fill('4242 4242 4242 4242');
  await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
  await page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }).click();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('4242424242424242');
  await expect(page.getByLabel('Son kullanma ayı', { exact: true })).toHaveValue('12');
});
