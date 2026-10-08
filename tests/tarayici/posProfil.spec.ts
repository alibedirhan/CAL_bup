import { test, expect, type Page, type Request } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { posKilidiniAc, YAPAY_PAROLA } from './yardimci';

const yol = '/CAL_bup/#/sanal-pos';
async function ortam(page: Page) {
  const hatalar: string[] = [];
  const istekler: Request[] = [];
  page.on('pageerror', (e) => hatalar.push(e.message));
  await page.context().route('**/*', async (r) => {
    const u = r.request().url();
    if (u.startsWith('http://127.0.0.1:4180/')) return r.continue();
    if (u === 'https://denizpay.bupilic.com.tr/login.aspx') {
      istekler.push(r.request());
      return r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Taklit POS</title><p>Yapay firma ekranı</p>',
      });
    }
    hatalar.push('Beklenmeyen dış bağlantı');
    await r.abort();
  });
  await page.goto(yol);
  await posKilidiniAc(page);
  await expect(page.getByRole('button', { name: 'Yeni cari', exact: true })).toBeVisible();
  return { hatalar, istekler };
}
async function cariEkle(page: Page, harf = 'A') {
  await page.getByRole('button', { name: 'Yeni cari', exact: true }).click();
  await page.getByLabel('Cari adı', { exact: true }).fill('Yapay Cari ' + harf);
  await page
    .getByLabel('Vergi/TC numarası', { exact: true })
    .fill(harf === 'A' ? '0123456789' : '00000000001');
  await page.getByLabel('Cari adı ve numaranın aynı kişiye ait olduğunu kontrol ettim.').check();
  await page.getByRole('button', { name: 'Cariyi kaydet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yapay Cari ' + harf, exact: true })).toBeVisible();
}
async function kartFormunuDoldur(page: Page, ad = 'Yapay şirket kartı', numara = '4242424242424242') {
  await page.getByLabel('Karta vereceğiniz isim').fill(ad);
  await page.getByLabel('Kart numarası', { exact: true }).fill(numara);
  await page.getByLabel('Kart üzerindeki ad').fill('Örnek Kart Sahibi');
  await page.getByLabel('Son kullanma ayı', { exact: true }).selectOption('12');
  await page.getByLabel('Son kullanma yılı', { exact: true }).selectOption('2035');
  await page
    .getByLabel('Kart sahibinin iletişim telefonu (isteğe bağlı)', { exact: true })
    .fill('0500 000 00 00');
  await page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
}
async function kartEkle(page: Page, ad = 'Yapay şirket kartı', numara = '4242424242424242') {
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await kartFormunuDoldur(page, ad, numara);
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.pos-odeme-karti').filter({ hasText: ad })).toBeVisible();
}
const cariSec = (page: Page, harf: string) =>
  page
    .locator('.pos-cari')
    .filter({ hasText: 'Yapay Cari ' + harf })
    .click();

test('parolalı kart kaydı, cari ayrımı, numara/CVV ekrana ve panoya çıkmaz, kalıcı şifreleme', async ({
  page,
}) => {
  const { hatalar, istekler } = await ortam(page);
  await cariEkle(page);
  await kartEkle(page);
  await expect(page.locator('.pos-odeme-karti[aria-pressed="true"]')).toHaveCount(0);
  await page.locator('.pos-odeme-karti').click();
  await expect(page.locator('.pos-secili-kart')).toContainText('+905000000000');
  // Kart numarasını/CVV'yi gösterme ve kopyalama yoktur; kart yalnız yardımcıyla aktarılır.
  await expect(
    page.getByRole('button', { name: /Kart numarasını|CVV’yi kopyala|Son kullanmayı kopyala/ }),
  ).toHaveCount(0);
  // Yenileyince kilit: anahtar yalnız sekmenin belleğindedir.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sanal POS kilitli' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Yapay Cari A');
  await posKilidiniAc(page);
  await cariSec(page, 'A');
  await expect(page.locator('.pos-odeme-karti')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('4242424242424242');
  await page.locator('.pos-odeme-karti').click();
  const popup = page.context().waitForEvent('page');
  await page.getByRole('button', { name: 'POS’u aç', exact: true }).click();
  const pos = await popup;
  await pos.waitForLoadState();
  expect(istekler).toHaveLength(1);
  expect(Object.fromEntries(new URLSearchParams(istekler[0]?.postData() ?? ''))).toMatchObject({
    lvergino: '0123456789',
    lkullaniciadi: '0123456789',
    lsifre: '0189',
  });
  expect(await pos.evaluate(() => window.opener)).toBeNull();
  await page.bringToFront();
  await cariEkle(page, 'B');
  await expect(page.locator('.pos-odeme-karti')).toHaveCount(0);
  await kartEkle(page, 'Yapay B kartı', '5555555555554444');
  await cariSec(page, 'A');
  await expect(page.locator('.pos-odeme-karti')).toContainText('Yapay şirket kartı');
  await expect(page.locator('.pos-odeme-karti[aria-pressed="true"]')).toHaveCount(0);
  const { zarf, anahtarlar } = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('bup-rapor', 1);
      r.onsuccess = () => resolve(r.result);
    });
    const depo = db.transaction('kv').objectStore('kv');
    const [z, a] = await Promise.all([
      new Promise<string>((resolve) => {
        const r = depo.get('sanal-pos-kasa-v1');
        r.onsuccess = () => resolve(JSON.stringify(r.result));
      }),
      new Promise<string[]>((resolve) => {
        const r = depo.getAllKeys();
        r.onsuccess = () => resolve(r.result.map(String));
      }),
    ]);
    db.close();
    return { zarf: z, anahtarlar: a };
  });
  expect(JSON.parse(zarf).kip).toBe('parola');
  // Şifre anahtarı hiçbir yere yazılmaz; parola veya açık kart bilgisi kayıtta yoktur.
  expect(anahtarlar.filter((k) => k.startsWith('sanal-pos-profil-anahtar-'))).toEqual([]);
  for (const sir of ['4242424242424242', '5555555555554444', '+905000000000', YAPAY_PAROLA])
    expect(zarf).not.toContain(sir);
  expect(hatalar).toEqual([]);
});

test('kart formu doğrulama, iptal, düzenleme ve doğru cariden silme', async ({ page }) => {
  const { hatalar } = await ortam(page);
  await cariEkle(page);
  await kartEkle(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await kartFormunuDoldur(page, 'Hatalı Yapay Kart', '4242424242424241');
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Kart numarası kontrolü geçmedi');
  await page.getByLabel('Kart numarası', { exact: true }).fill('4242424242424242');
  await expect(
    page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.'),
  ).not.toBeChecked();
  await page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(
    page.getByText('Bu kart numarası seçilen caride zaten kayıtlı.', { exact: false }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.pos-odeme-karti')).toHaveCount(1);
  await page.getByRole('button', { name: 'Yapay şirket kartı kartını düzenle', exact: true }).click();
  await page.getByLabel('Karta vereceğiniz isim').fill('Düzenlenen Yapay Kart');
  await page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.locator('.pos-odeme-karti')).toContainText('Düzenlenen Yapay Kart');
  page.once('dialog', async (d) => {
    expect(d.message()).toContain('Yapay Cari A');
    expect(d.message()).toContain('4242');
    await d.accept();
  });
  await page.getByRole('button', { name: 'Düzenlenen Yapay Kart kartını sil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Henüz kayıtlı kart yok' })).toBeVisible();
  expect(hatalar).toEqual([]);
});

test('yedek bölümü yok; elle kilit, yanlış parola, parola unutulunca her şey silinir', async ({ page }) => {
  const { hatalar } = await ortam(page);
  await cariEkle(page);
  await kartEkle(page);
  await expect(page.getByRole('button', { name: 'Şifreli yedeği indir' })).toHaveCount(0);
  await expect(page.getByText('Şifreli yedekten kayıt ekle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Şimdi kilitle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sanal POS kilitli' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Yapay Cari A');
  await page.getByLabel('Sanal POS parolası', { exact: true }).fill('Yanlis-parola-1');
  await page.getByRole('button', { name: 'Kilidi aç', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Parola yanlış' })).toBeVisible();
  await posKilidiniAc(page);
  await expect(page.locator('.pos-cari')).toContainText('Yapay Cari A');
  // Parolayı unutma: onay yazılmadan silinmez; onaylanınca bütün kayıtlar gider.
  await page.getByRole('button', { name: 'Şimdi kilitle', exact: true }).click();
  await page.getByRole('button', { name: 'Parolamı unuttum', exact: true }).click();
  const sil = page.getByRole('button', { name: 'Bütün kayıtları sil ve yeniden başla', exact: true });
  await expect(sil).toBeDisabled();
  await page.getByLabel('Onaylamak için büyük harflerle SİL yazın').fill('SİL');
  await sil.click();
  await expect(page.getByRole('heading', { name: 'Sanal POS parolası belirleyin' })).toBeVisible();
  await posKilidiniAc(page, 'Yeni-yapay-kilit-7');
  await expect(page.locator('.pos-cari')).toHaveCount(0);
  expect(hatalar).toEqual([]);
});

test('başka sekmede kart kaydı yenilenir; açık form korunur, eski kart sessizce ezilmez', async ({
  page,
  context,
}) => {
  await ortam(page);
  await cariEkle(page);
  await kartEkle(page);
  const ikinci = await context.newPage();
  await ikinci.goto(yol);
  await posKilidiniAc(ikinci);
  await cariSec(ikinci, 'A');
  await ikinci.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await ikinci.getByLabel('Karta vereceğiniz isim').fill('Yarım kalan yapay kart');
  await kartEkle(page, 'Öteki sekmenin kartı', '5555555555554444');
  // Öteki sekmenin kaydı bu sekmedeki yarım formu kapatmaz; liste arkada güncellenir.
  await expect(ikinci.getByRole('dialog')).toBeVisible();
  await expect(ikinci.getByLabel('Karta vereceğiniz isim')).toHaveValue('Yarım kalan yapay kart');
  await expect(ikinci.locator('.pos-odeme-karti')).toHaveCount(2);
  await ikinci.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  // İki sekmede aynı kart düzenlenirse sonra kaydeden diğerinin değişikliğini ezemez.
  await ikinci.getByRole('button', { name: 'Yapay şirket kartı kartını düzenle', exact: true }).click();
  await ikinci.getByLabel('Karta vereceğiniz isim').fill('İkinci sekmenin adı');
  await page.getByRole('button', { name: 'Yapay şirket kartı kartını düzenle', exact: true }).click();
  await page.getByLabel('Karta vereceğiniz isim').fill('Birinci sekmenin adı');
  await page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.locator('.pos-odeme-karti').filter({ hasText: 'Birinci sekmenin adı' })).toBeVisible();
  await expect(ikinci.locator('.pos-odeme-karti').filter({ hasText: 'Birinci sekmenin adı' })).toBeVisible();
  await ikinci.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
  await ikinci.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(ikinci.getByRole('dialog')).toContainText('başka sekmede değiştirildi');
  await ikinci.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await expect(ikinci.locator('.pos-odeme-karti').filter({ hasText: 'İkinci sekmenin adı' })).toHaveCount(0);
});

test('fotoğraf gerçek yerel OCR ile okunur; CVV/fotoğraf kayda girmez; iptal yeniden kullanılabilir', async ({
  page,
}) => {
  const { hatalar, istekler } = await ortam(page);
  await cariEkle(page);
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1500;
    c.height = 650;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas yok');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    ctx.font = '64px monospace';
    ctx.fillText('4242 4242 4242 4242', 90, 250);
    ctx.fillText('12/35', 90, 420);
    ctx.fillText('123', 1100, 530);
    return c.toDataURL('image/png').split(',')[1] ?? '';
  });
  await page
    .getByLabel('Kart fotoğrafından numara ve tarih oku')
    .setInputFiles({ name: 'yapay-kart.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByRole('heading', { name: 'Fotoğraftan bulunan alanlar', exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('');
  await page.getByLabel('Bulunan numara ve tarihi fotoğrafla karşılaştırdım.').check();
  await page.getByRole('button', { name: 'Kontrol ettiğim alanları uygula', exact: true }).click();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('4242424242424242');
  await expect(page.getByLabel('Son kullanma ayı', { exact: true })).toHaveValue('12');
  await expect(page.getByLabel('Son kullanma yılı', { exact: true })).toHaveValue('2035');
  await page.getByLabel('Karta vereceğiniz isim').fill('Fotoğraftan Yapay Kart');
  await page.getByLabel('Kart bilgilerini ve bu cari altında kaydetmeyi kontrol ettim.').check();
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.locator('.pos-odeme-karti')).toContainText('Fotoğraftan Yapay Kart');
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page.context().route('**/ocr/worker.min.js', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await r.continue();
  });
  await page
    .getByLabel('Kart fotoğrafından numara ve tarih oku')
    .setInputFiles({ name: 'yapay-kart.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Okumayı durdur', exact: true }).click();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(istekler).toHaveLength(0);
  expect(hatalar).toEqual([]);
});

test('açık/koyu/dar görünüm; gizli sekmede kart formu korunur ve numara örtülür', async ({ page }) => {
  const { hatalar } = await ortam(page);
  await cariEkle(page);
  await kartEkle(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: join(tmpdir(), `cal-bup-gercek-kart-profili-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Koyu', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: join(tmpdir(), 'cal-bup-gercek-kart-profili-koyu.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await page.getByLabel('Kart numarası', { exact: true }).fill('5555555555554444');
  await gizleVeGoster(page);
  // Gizli sekmede form kapanmaz; yazılan numara korunur ama ekranda örtülür.
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('5555555555554444');
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveClass(/pos-gizli-girdi/);
  await page.getByRole('button', { name: 'Gizlenen bilgileri göster', exact: true }).click();
  await expect(page.getByLabel('Kart numarası', { exact: true })).not.toHaveClass(/pos-gizli-girdi/);
  expect(hatalar).toEqual([]);
});

async function gizleVeGoster(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('iki dakika boşta kalınca açık formlar kapanmaz; yalnız açık numara gizlenir', async ({ page }) => {
  await page.clock.install();
  const { hatalar } = await ortam(page);
  await cariEkle(page);
  await page.getByRole('button', { name: 'Yeni cari', exact: true }).click();
  await page.getByLabel('Cari adı', { exact: true }).fill('Yarım Yapay Cari');
  await page.clock.runFor(125_000);
  await expect(page.getByLabel('Cari adı', { exact: true })).toHaveValue('Yarım Yapay Cari');
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await cariSec(page, 'A');
  await page.getByRole('button', { name: 'Kart ekle', exact: true }).click();
  await kartFormunuDoldur(page);
  await page.clock.runFor(125_000);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Kart numarası', { exact: true })).toHaveValue('4242424242424242');
  await expect(page.getByRole('button', { name: 'Gizlenen bilgileri göster', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kartı kaydet', exact: true }).click();
  await expect(page.locator('.pos-odeme-karti')).toContainText('Yapay şirket kartı');
  expect(hatalar).toEqual([]);
});

test('10 dakika işlem yapılmazsa kilitlenir; numarayla arama çalışır', async ({ page }) => {
  await page.clock.install();
  const { hatalar } = await ortam(page);
  await cariEkle(page);
  await cariEkle(page, 'B');
  // Numara ile arama: en az üç rakam.
  await page.getByLabel('Cari adına veya numarasına göre ara').fill('0000');
  await expect(page.locator('.pos-cari')).toHaveCount(1);
  await expect(page.locator('.pos-cari')).toContainText('Yapay Cari B');
  await page.clock.runFor(9 * 60_000);
  await expect(page.locator('.pos-cari')).toHaveCount(1);
  await page.clock.runFor(61_000);
  await expect(page.getByRole('heading', { name: 'Sanal POS kilitli' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Yapay Cari B');
  await expect(page.getByText('Uzun süre işlem yapılmadığı için', { exact: false })).toBeVisible();
  await posKilidiniAc(page);
  await expect(page.locator('.pos-cari')).toHaveCount(2);
  expect(hatalar).toEqual([]);
});
