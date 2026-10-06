import { test, expect, type Page, type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import referans from '../yardimci/veriler/yaslandirmaReferansi.json' with { type: 'json' };

// Yalnız yapay başvuru dosyaları kullanılır; gerçek rapor yoktur.
const senaryo = (ad: string) => {
  const s = referans.senaryolar.find((x) => x.ad === ad);
  if (!s) throw new Error('Başvuru yok: ' + ad);
  return s;
};
async function ac(page: Page) {
  await page.goto('/CAL_bup/');
  await page
    .getByRole('navigation', { name: 'Satış', exact: true })
    .getByRole('link', { name: 'Yaşlandırma', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Yaşlandırma', level: 1 })).toBeVisible();
}
async function yukle(page: Page, bayt: string, ad = 'Yapay yaşlandırma.xlsx') {
  await page.getByLabel('Yaşlandırma raporu', { exact: true }).setInputFiles({
    name: ad,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(bayt, 'base64'),
  });
  await page.getByRole('button', { name: 'Analiz et', exact: true }).click();
}
const hazir = (page: Page) =>
  expect(page.getByRole('button', { name: 'İşlemi durdur', exact: true })).toHaveCount(0, {
    timeout: 45_000,
  });
async function indir(page: Page, ad: RegExp): Promise<Download> {
  const d = page.waitForEvent('download', { timeout: 45_000 });
  await page.getByRole('button', { name: ad }).click();
  return d;
}
async function hucreler(d: Download) {
  const yol = await d.path();
  if (!yol) throw new Error('İndirme yok.');
  const w = new ExcelJS.Workbook();
  await w.xlsx.load((await readFile(yol)) as unknown as ExcelJS.Buffer);
  return w.worksheets.map((s) => ({
    ad: s.name,
    satirlar: s
      .getSheetValues()
      .slice(1)
      .map((r) => (Array.isArray(r) ? r.slice(1) : [])),
  }));
}
const araclar = (page: Page) =>
  page.getByRole('table', { name: 'Araç bazlı yaşlandırma özeti', exact: true }).locator('tbody tr');

test('Yaşlandırma: masaüstü hesabı, arama/29+/sıralama, tam ve görünen Excel kapalı ağda', async ({
  page,
  context,
}) => {
  const dis: string[] = [];
  context.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4180/')) dis.push(r.url());
  });
  const s = senaryo('temel');
  await ac(page);
  await yukle(page, s.bayt);
  await expect(araclar(page)).toHaveCount(s.ozet.vehicle_count, { timeout: 45_000 });
  await hazir(page);
  const ozet = page.locator('.musteri-ozet').first();
  await expect(ozet).toContainText(String(s.ozet.total_customers));
  await expect(araclar(page).locator('td:first-child')).toHaveText(s.ozet.vehicles.map((v) => v.arac_no));
  // Cari adıyla arama aracı bulur.
  await page.getByLabel('Araç no veya cari ara').fill('gama');
  await expect(araclar(page)).toHaveCount(1);
  await expect(araclar(page).first()).toContainText('2');
  await page.getByLabel('Araç no veya cari ara').fill('');
  // 29+ gün süzgeci: yalnız 29–77+ kovalarında pozitif bakiyesi olan araçlar.
  await page.getByLabel('Sadece 29+ gün bakiyesi olan araçlar').check();
  const gec = s.ozet.vehicles.filter((v) =>
    Object.entries(v.yaslanding_analizi).some(
      ([k, t]) => t > 0 && /29-35|36-42|43-49|50-56|57-63|64-70|71-77|77\+/.test(k),
    ),
  );
  await expect(araclar(page)).toHaveCount(gec.length);
  await page.getByLabel('Sadece 29+ gün bakiyesi olan araçlar').uncheck();
  // Toplam bakiyeye göre azalan sıralama.
  await page.getByRole('button', { name: /^Toplam Bakiye/ }).click();
  await page.getByRole('button', { name: /^Toplam Bakiye/ }).click();
  const azalan = [...s.ozet.vehicles].sort((a, b) => b.toplam_bakiye - a.toplam_bakiye).map((v) => v.arac_no);
  await expect(araclar(page).locator('td:first-child')).toHaveText(azalan);
  // Tam Excel: iki sayfa, masaüstü hücreleriyle aynı.
  const tam = await indir(page, /^Excel’e aktar$/);
  expect(tam.suggestedFilename()).toBe('Yaslandirma_Analizi.xlsx');
  await hazir(page);
  expect((await hucreler(tam)).map((x) => x.ad)).toEqual(s.tamExcel.map((x) => x.ad));
  expect((await hucreler(tam))[0]?.satirlar).toEqual(s.tamExcel[0]?.satirlar);
  // Görünen Excel ekrandaki sırayı ve süzgeci kullanır.
  await page.getByLabel('Sadece 29+ gün bakiyesi olan araçlar').check();
  const gorunen = await indir(page, /^Görünenleri Excel’e aktar/);
  expect(gorunen.suggestedFilename()).toBe('Yaslandirma_Gorunen_Araclar.xlsx');
  await hazir(page);
  const g = await hucreler(gorunen);
  const veriSatirlari = g[0]?.satirlar.filter((r) => azalan.includes(String(r[0]))) ?? [];
  const gecNo = new Set(gec.map((v) => v.arac_no));
  expect(veriSatirlari.map((r) => String(r[0]))).toEqual(azalan.filter((no) => gecNo.has(no)));
  // Kova tablosu: durum metinle de verilir.
  await page.getByRole('button', { name: 'Yaşlandırma Kovaları', exact: true }).click();
  const kovalar = page.getByRole('table', { name: 'Yaşlandırma kovası toplamları', exact: true });
  await expect(kovalar.locator('tbody tr')).toHaveCount(s.raporlar.kovalar.length);
  await expect(kovalar).toContainText('Kritik (57+ gün)');
  await expect(kovalar).toContainText('Uyarı (29–56 gün)');
  expect(dis).toEqual([]);
});

test('Yaşlandırma: araç detayı, dört rapor ve grafikler aynı analizden', async ({ page }) => {
  const s = senaryo('kirk-arac');
  await ac(page);
  await yukle(page, s.bayt);
  await expect(araclar(page)).toHaveCount(40, { timeout: 45_000 });
  await hazir(page);
  await page.getByRole('button', { name: 'Araç 12 detayını aç' }).click();
  const d = s.raporlar.detaylar.find((x) => x.arac_no === '12');
  if (!d) throw new Error('Detay yok');
  await expect(page.getByLabel('Araç seçin')).toHaveValue('12');
  const tablo = page.getByRole('table', { name: 'Araç 12 en yüksek bakiyeli müşteriler' });
  await expect(tablo.locator('tbody tr')).toHaveCount(d.top_customers.length);
  await expect(tablo.locator('tbody tr').first()).toContainText(d.top_customers[0]?.cari_unvan ?? '');
  await page.getByRole('button', { name: 'Raporlar', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Özet raporu' }).locator('tbody tr')).toHaveCount(40);
  await page.getByRole('button', { name: 'Detaylı', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Detaylı raporu' }).locator('tbody tr')).toHaveCount(100);
  await expect(page.getByText('120 satır · Sayfa 1 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'Karşılaştırma', exact: true }).click();
  const ilk = s.raporlar.siralama[0]?.arac_no;
  await expect(
    page.getByRole('table', { name: 'Karşılaştırma raporu' }).locator('tbody tr').first(),
  ).toContainText(`Araç ${ilk}`);
  await page.getByRole('button', { name: 'Yaşlandırma', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Yaşlandırma raporu' })).toContainText('%');
  await page.getByRole('button', { name: 'Grafikler', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'Araç Bazlı Bakiye (en yüksek 10)' }).locator('li'),
  ).toHaveCount(10);
  await expect(page.getByRole('list', { name: 'Vade Kovası Dağılımı' }).locator('li')).toHaveCount(
    s.raporlar.kovalar.length,
  );
});

test('Yaşlandırma: atama ekle/güncelle/kaldır/geri al tarayıcıda saklanır; hatalı dosya açık mesaj verir', async ({
  page,
}) => {
  await ac(page);
  for (const h of referans.hatalar.filter((x) => ['baslik-yok', 'veri-yok', 'zip-bozuk'].includes(x.ad))) {
    await yukle(page, h.bayt, `Yapay ${h.ad}.xlsx`);
    await hazir(page);
    // Bozuk ZIP, masaüstü okuyucusundan önce CAL'nin daha sıkı arşiv denetimine takılır.
    await expect(page.locator('#yaslandirma-hatasi')).toContainText(
      h.ad === 'zip-bozuk' ? 'Excel dosyası bozuk' : h.mesaj,
    );
  }
  await page.getByRole('button', { name: 'Atama', exact: true }).click();
  await expect(page.getByText('Henüz araç ataması yok.', { exact: false })).toBeVisible({ timeout: 45_000 });
  await hazir(page);
  await page.getByRole('button', { name: 'Ata / Güncelle', exact: true }).click();
  await expect(page.getByText('Araç no ve sorumlu zorunludur.')).toBeVisible();
  for (const [arac, kisi] of [
    ['5', 'Yapay Sorumlu A'],
    ['7', 'Yapay Sorumlu B'],
  ] as const) {
    await page.getByLabel('Araç no', { exact: true }).fill(arac);
    await page.getByLabel('Sorumlu', { exact: true }).fill(kisi);
    await page.getByLabel('Telefon', { exact: true }).fill('0500 000 00 00');
    await page.getByRole('button', { name: 'Ata / Güncelle', exact: true }).click();
    await expect(page.getByText(`Araç ${arac} atandı.`)).toBeVisible({ timeout: 45_000 });
    await hazir(page);
  }
  const tablo = page.getByRole('table', { name: 'Araç atamaları', exact: true });
  await expect(tablo.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByText('İş yükü — Yapay Sorumlu A: 1 araç, Yapay Sorumlu B: 1 araç')).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.getByLabel('Araç 7 atamasını seç').check();
  await page.getByRole('button', { name: 'Seçiliyi Kaldır', exact: true }).click();
  await expect(tablo.locator('tbody tr')).toHaveCount(1, { timeout: 45_000 });
  await hazir(page);
  await page.getByRole('button', { name: 'Son Değişikliği Geri Al', exact: true }).click();
  await expect(tablo.locator('tbody tr')).toHaveCount(2, { timeout: 45_000 });
  await hazir(page);
  await page.reload();
  await page.getByRole('button', { name: 'Atama', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Araç atamaları', exact: true }).locator('tbody tr'),
  ).toHaveCount(2, {
    timeout: 45_000,
  });
});
