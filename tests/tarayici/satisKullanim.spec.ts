import { test, expect } from '@playwright/test';
import karlilik from '../yardimci/veriler/karlilikReferansi.json' with { type: 'json' };
import iskonto from '../yardimci/veriler/iskontoReferansi.json' with { type: 'json' };
import yaslandirma from '../yardimci/veriler/yaslandirmaReferansi.json' with { type: 'json' };

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
test.use({ viewport: { width: 1366, height: 657 } });

test('Kârlılık: Analiz et iş yeri ekranında görünür; sonuç tablosu tam genişlikte açılır', async ({
  page,
}) => {
  const s = karlilik.senaryolar[0];
  if (!s) throw new Error('Başvuru yok.');
  await page.goto('/CAL_bup/#/satis/karlilik');
  for (const [tur, label] of [
    ['satis', 'Kârlılık satış raporu'],
    ['fiyat', 'Kârlılık fiyat raporu'],
  ] as const)
    await page.getByLabel(label, { exact: true }).setInputFiles({
      name: `Yapay ${tur}.xlsx`,
      mimeType: XLSX,
      buffer: Buffer.from(s.girdiler[tur], 'base64'),
    });
  const analiz = page.getByRole('button', { name: 'Analiz et', exact: true });
  await expect(analiz).toBeInViewport();
  await analiz.click();
  const tablo = page.getByRole('table', { name: 'Kârlılık sonuç tablosu', exact: true });
  await expect(tablo).toBeVisible({ timeout: 30_000 });
  expect((await tablo.boundingBox())?.width).toBeGreaterThan(900);
});

test('İskonto: Önizleme oluştur görünür; önizleme tablosu kesilmeden tam genişlikte', async ({ page }) => {
  await page.goto('/CAL_bup/#/satis/iskonto');
  await page.getByLabel('PDF fiyat listeleri', { exact: true }).setInputFiles(
    iskonto.belgeler.slice(0, 3).map((d) => ({
      name: d.ad,
      mimeType: 'application/pdf',
      buffer: Buffer.from(d.bayt, 'base64'),
    })),
  );
  const onizle = page.getByRole('button', { name: 'Önizleme oluştur', exact: true });
  await expect(onizle).toBeEnabled({ timeout: 30_000 });
  await onizle.scrollIntoViewIfNeeded();
  await onizle.click();
  const tablo = page.getByRole('table', { name: 'İskonto sonuç tablosu', exact: true });
  await expect(tablo).toBeVisible({ timeout: 30_000 });
  const kap = await tablo.locator('xpath=..').boundingBox();
  const genislik = await tablo.boundingBox();
  expect(genislik?.width).toBeGreaterThan(900);
  // Tablo kabından taşmaz: “İskontolu” ve “Fark” sütunları kaydırmadan görünür
  expect(genislik?.width ?? 0).toBeLessThanOrEqual((kap?.width ?? 0) + 1);
});

test('Yaşlandırma: büyük tutar kutusunda tutar ile TL aynı satırda kalır', async ({ page }) => {
  const s = yaslandirma.senaryolar.find((x) => x.ad === 'kirk-arac');
  if (!s) throw new Error('Başvuru yok.');
  await page.goto('/CAL_bup/#/satis/yaslandirma');
  await page.getByLabel('Yaşlandırma raporu', { exact: true }).setInputFiles({
    name: 'Yapay yaşlandırma.xlsx',
    mimeType: XLSX,
    buffer: Buffer.from(s.bayt, 'base64'),
  });
  await page.getByRole('button', { name: 'Analiz et', exact: true }).click();
  const tutar = page.locator('.musteri-ozet dd').filter({ hasText: 'TL' }).first();
  await expect(tutar).toBeVisible({ timeout: 45_000 });
  const kutu = await tutar.boundingBox();
  expect(kutu?.height ?? 0).toBeLessThan(40);
});
