import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
type Dosya = { name: string; mimeType: string; buffer: Buffer };

/** Ayarlar'daki yapay deneme paketinin dört Excel dosyası. */
async function denemeDosyalari(page: Page): Promise<Record<string, Dosya>> {
  await page.goto('/CAL_bup/#/ayarlar');
  const [indirme] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Deneme dosyalarını indir' }).click(),
  ]);
  const yol = await indirme.path();
  if (!yol) throw new Error('Yapay paket indirilemedi');
  const zip = await JSZip.loadAsync(await readFile(yol));
  const sonuc: Record<string, Dosya> = {};
  for (const name of Object.keys(zip.files).filter((a) => a.endsWith('.xlsx')))
    sonuc[name] = {
      name,
      mimeType: XLSX,
      buffer: (await zip.files[name]?.async('nodebuffer')) ?? Buffer.alloc(0),
    };
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  return sonuc;
}

const ledGirdisi = (page: Page) => page.locator('input[type=file][multiple]');

test('tarihi uymayan dosyalar sağda tek soruda toplanır, dosyaların günü tek tıkla seçilir', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const d = await denemeDosyalari(page);
  await ledGirdisi(page).setInputFiles(Object.values(d));
  await expect(page.getByRole('button', { name: 'İndir', exact: true })).toBeEnabled();

  await page.getByLabel('Oluşturulacak gün').fill('03.10');
  const soru = page.getByRole('heading', { name: 'Dosya tarihleri seçilen günle uyuşmuyor' });
  await expect(soru).toBeInViewport();
  await expect(page.getByText('Arada gün sayfası açılmamış: 02.10.2026.')).toBeVisible();
  await page.getByRole('button', { name: 'Günü 02.10 yap' }).click();
  await expect(page.locator('#gun-aciklama')).toContainText('02.10.2026 Cuma');
  await expect(page.getByRole('button', { name: 'İndir', exact: true })).toBeEnabled();

  // Aynı soruya "devam et" ile de geçilebilir; uyarı kayda geçer
  await page.getByLabel('Oluşturulacak gün').fill('03.10');
  await page.getByRole('button', { name: 'Evet, bu dosyalarla devam et' }).click();
  await expect(page.getByText('D01: dosya tarihi 02.10.2026 (beklenen 03.10.2026)')).toBeVisible();
  await expect(
    page.locator('.kontrol').getByText(/Arada gün sayfası açılmamış: 02\.10\.2026\. Bu gün 01\.10/),
  ).toBeVisible();
});

test('var olan gün sağdan sorulur; vazgeçince önerilen yeni güne dönülür', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const d = await denemeDosyalari(page);
  await ledGirdisi(page).setInputFiles(Object.values(d));
  await page.getByLabel('Oluşturulacak gün').fill('01.10');
  await expect(page.getByRole('heading', { name: "'01.10' sayfası zaten var" })).toBeInViewport();
  await page.getByRole('button', { name: 'Hayır, yeni gün (02.10) hazırla' }).click();
  await expect(page.getByLabel('Oluşturulacak gün')).toHaveValue('');
  await expect(page.locator('#gun-aciklama')).toContainText('02.10.2026 Cuma');

  // Farkı olan ürünler tek düğmeyle, en büyük fark üstte gösterilir
  await page.getByRole('button', { name: 'Göster', exact: true }).click();
  await expect(page.getByRole('button', { name: /Fark var/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tablo tbody tr')).toHaveCount(1);
  await expect(page.locator('.tablo tbody tr').first()).toContainText('YAPAY ALFA');
});

test('eksik LED dosyaları sağdaki düğmeyle seçilebilir ve tarihleriyle listelenir', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const d = await denemeDosyalari(page);
  const hedef = d['YAPAY_DEPO_KONTROL.xlsx'];
  if (!hedef) throw new Error('Hedef yok');
  await ledGirdisi(page).setInputFiles([hedef]);
  await expect(page.getByRole('heading', { name: '3 LED dosyası bekleniyor' })).toBeInViewport();
  await expect(page.getByText('· 01.10.2026 tarihli')).toBeVisible();
  const [secici] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'LED dosyalarını seç' }).click(),
  ]);
  await secici.setFiles(Object.values(d).filter((x) => x !== hedef));
  await expect(page.getByRole('button', { name: 'İndir', exact: true })).toBeEnabled();
});

test('toplam kontrolü tutmazsa açık onay olmadan kaydedilmez; sonuçta özet görünür', async ({ page }) => {
  const d = await denemeDosyalari(page);
  // D01'in dip toplamı satırların toplamından farklı: LED stoğu kontrolü tutmaz
  const wb = new ExcelJS.Workbook();
  const ilk = d['YAPAY_D01.xlsx'];
  if (!ilk) throw new Error('D01 yok');
  await wb.xlsx.load(ilk.buffer as unknown as ExcelJS.Buffer);
  const s = wb.worksheets[0];
  if (!s) throw new Error('D01 sayfası yok');
  s.getCell('H7').value = 18;
  const bozuk = { ...ilk, buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
  await ledGirdisi(page).setInputFiles([
    ...Object.values(d).filter((x) => x.name !== 'YAPAY_D01.xlsx'),
    bozuk,
  ]);
  const indir = page.getByRole('button', { name: 'İndir', exact: true });
  await expect(page.locator('.kontrol .rozet.durum')).toContainText('Hata');
  await expect(indir).toBeDisabled();
  await page.getByLabel(/Toplam kontrolü tutmuyor/).check();
  await expect(indir).toBeEnabled();
  await Promise.all([page.waitForEvent('download'), indir.click()]);
  await expect(page.getByText('02.10 sayfası hazır, indirme başlatıldı')).toBeVisible();
  await expect(page.locator('.sonuc-ozeti')).toContainText('Hata');
  await expect(page.locator('.sonraki-adimlar')).toContainText('eskisinin yerine koyun');
});
