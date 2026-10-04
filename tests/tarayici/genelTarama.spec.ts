import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { eklentiOrtami, yapayKartliCari, kartliPosAc } from './eklentiYardimci';

async function hedefKur(page: Page) {
  const w = new ExcelJS.Workbook();
  for (const ad of ['02.10', '03.10']) {
    const s = w.addWorksheet(ad);
    s.getCell('G1').value = 'GELEN MAL';
    s.getCell('A4').value = 'Yapay Ürün';
    s.getCell('B5').value = { formula: 'SUM(B4:B4)', result: 0 };
  }
  await page.goto('/CAL_bup/');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'Yapay.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await w.xlsx.writeBuffer()),
    });
  await expect(page.locator('#gun-girdisi')).toBeVisible();
}
test('pazar ayarı değişince açık dosyanın gün önerisi yenilenir', async ({ page }) => {
  await hedefKur(page);
  await expect(page.locator('#gun-girdisi')).toHaveAttribute('placeholder', '05.10');
  await page.getByRole('link', { name: 'Ayarlar', exact: true }).click();
  await page.locator('#pazar').click();
  await page.getByRole('link', { name: 'Günlük depo kontrol', exact: true }).click();
  await expect(page.locator('#gun-girdisi')).toHaveAttribute('placeholder', '04.10');
});
test('dosya okunurken gün değiştirme engellenir', async ({ page }) => {
  await hedefKur(page);
  await page.evaluate(() => {
    const asil = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      return new Promise((coz) => {
        Object.defineProperty(globalThis, 'yapayDosyayiBitir', {
          configurable: true,
          value: async () => coz(await asil.call(this)),
        });
      });
    };
  });
  await page
    .locator('input[type=file]')
    .last()
    .setInputFiles({
      name: 'Yapay LED.xlsx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('yapay'),
    });
  await expect(page.locator('#gun-girdisi')).toBeDisabled();
  await page.getByRole('button', { name: 'İşlemi durdur', exact: true }).click();
  await page.evaluate(() => Reflect.get(globalThis, 'yapayDosyayiBitir')?.());
  await expect(page.locator('#gun-girdisi')).toBeEnabled();
});
test('ilk ürün satırının kesirli değeri sessizce yuvarlanmaz', async ({ page }) => {
  await page.goto('/CAL_bup/#/ayarlar');
  await page.getByText('Gelişmiş: dosya düzenleri', { exact: true }).click();
  await page.getByLabel('Gün sayfasında ilk ürün satırı', { exact: true }).fill('4,5');
  await page.getByLabel('Gün sayfasında ilk ürün satırı', { exact: true }).press('Tab');
  await expect(page.locator('#ilk-satir')).toHaveAttribute('aria-invalid', 'true');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('bup-rapor:ayarlar') ?? '{}').hedefIlkSatir ?? 4,
    ),
  ).toBe(4);
});
for (const elle of [false, true])
  test(
    elle
      ? 'elle yeni POS girişi bekleyen kart aktarımını iptal eder'
      : 'kartı düzenlemeye başlamak bekleyen aktarımı iptal eder',
    async () => {
      const e = await eklentiOrtami();
      try {
        await yapayKartliCari(e.p);
        const pos = await kartliPosAc(e.p, e.c);
        await expect(pos.locator('#cal-bup-pos-yardimcisi')).toContainText('henüz tanıtılmadı');
        if (elle) await e.p.getByRole('button', { name: 'POS’u aç', exact: true }).click();
        else
          await e.p.getByRole('button', { name: 'Yapay Eklenti Kartı kartını düzenle', exact: true }).click();
        const w = e.c.serviceWorkers()[0];
        if (!w) throw new Error('Yapay yardımcı worker eksik');
        await expect
          .poll(() =>
            w.evaluate(async () => {
              const ch = Reflect.get(globalThis, 'chrome');
              return (await ch.storage.session.get('isler')).isler.some((i: { kart?: unknown }) =>
                Boolean(i.kart),
              );
            }),
          )
          .toBe(false);
        await expect(pos.locator('#kart')).toHaveValue('');
        expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
      } finally {
        await e.kapat();
      }
    },
  );

test('profil kaydı başarısız olup depo kapanınca eski kartlar işlem için kullanılmaz', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    await e.p.evaluate(() => {
      const asil = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...a) {
        if (!Reflect.get(globalThis, 'yapayYazmaAcik'))
          throw new DOMException('Yapay kayıt arızası', 'QuotaExceededError');
        return asil.apply(this, a);
      };
    });
    await e.p.getByRole('button', { name: 'Yapay Eklenti Kartı kartını düzenle', exact: true }).click();
    await e.p.getByLabel('Karta vereceğiniz isim').fill('Yapay Yeni Kart Adı');
    await e.p.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
    await e.p.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
    await expect(
      e.p.getByRole('button', { name: 'Profil durumunu yeniden kontrol et', exact: true }),
    ).toBeVisible();
    await expect(e.p.locator('.pos-odeme-karti')).toHaveCount(0);
    await expect(e.p.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true })).toHaveCount(0);
    await expect(e.p.getByRole('alert')).toContainText('yeniden kontrol');
    await e.p.evaluate(() => Reflect.set(globalThis, 'yapayYazmaAcik', true));
    await e.p.getByRole('button', { name: 'Profil durumunu yeniden kontrol et', exact: true }).click();
    await e.p
      .getByRole('button', { name: /Yapay Eklenti Cari/ })
      .first()
      .click();
    await expect(e.p.locator('.pos-odeme-karti')).toContainText('Yapay Eklenti Kartı');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('açık sayfada kartın süresi dolarsa aktarım düğmesi de kapanır', async () => {
  const e = await eklentiOrtami();
  try {
    await yapayKartliCari(e.p);
    await e.p.clock.install({ time: new Date('2036-01-01T00:00:00Z') });
    await e.p.clock.fastForward(1001);
    await expect(e.p.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true })).toBeDisabled();
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
