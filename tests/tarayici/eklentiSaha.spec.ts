import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { eklentiOrtami, yapayKartliCari, APP, POS } from './eklentiYardimci';

// 2026-10-07 saha denemesindeki durumların YAPAY karşılıkları (docs/SANAL_POS_SAHA_TESTI_RAPORU.md).
// Gerçek POS'a istek yoktur: bütün adresler route ve kapalı proxy ile karşılanır. Numaralar yapaydır.
const A = '0123456789';
const B = '10000000146';
type Duzen = { kimliksiz?: boolean; ekSatir?: boolean; epostaYok?: boolean };
function odemeSayfasi(no: string, v: Duzen) {
  const k = (id: string) => (v.kimliksiz ? '' : `id="${id}" name="ctl00$Icerik$${id}"`);
  const satir = (b: string, kutu: string) =>
    `<div class="satir"><div class="baslik"><span>${b}</span></div><div>${kutu}</div></div>`;
  return `<!doctype html><body>
    ${v.ekSatir ? '<div class="duyuru">Yapay duyuru: bu caride fazladan bir satır var.</div>' : ''}
    <div class="ust">Firma İsmi : <span>YAPAY CARİ (${no})</span></div>
    <div class="kartlar"><div>(TL) BAKİYE -1000,00</div></div>
    <div class="form">
      ${v.epostaYok ? '' : satir('Tanımlı E-Mail Adresi', '<input readonly value="yapay@ornek.test">')}
      ${satir('Ad Soyad', `<input ${k('ad')}>`)}
      ${satir('Kredi Kartı Numarası', `<input ${k('kart')}>`)}
      <div class="ikili">
        <div class="sutun"><div class="baslik"><span>S.K.T</span></div><div><input ${k('tarih')}></div></div>
        <div class="sutun"><div class="baslik"><span>CVV</span></div><div><input ${k('cvv')}></div></div>
      </div>
      ${satir('Tutar', '<input class="tutar" value="-1000,00"><span>TL</span>')}
      <button type="button">Ödeme İşlemine Devam Et</button>
    </div></body>`;
}
const kutu = (p: Page, baslik: string) => p.locator('.satir, .sutun', { hasText: baslik }).locator('input');
const panel = (p: Page) => p.locator('#cal-bup-pos-yardimcisi');
const GIRIS_FORMU = (hata = '') =>
  `<form id="form1" action="./login.aspx" method="post"><input id="lvergino" name="lvergino"><input id="lkullaniciadi" name="lkullaniciadi"><input id="lsifre" name="lsifre" type="password"><span id="lblgizleme">${hata}</span></form>`;

/** Giriş POST'unda gelen numaraya göre o carinin ödeme sayfasına yönlendirir. `ret`: bu numaralar reddedilir. */
async function sahteSaglayici(
  c: BrowserContext,
  duzen: (no: string) => Duzen,
  v: { ret?: string[]; yol?: (no: string) => string; girisler?: URLSearchParams[] } = {},
) {
  await c.route(POS + '/**', async (r) => {
    const u = new URL(r.request().url());
    const yol = u.pathname.toLowerCase();
    if (yol === '/login.aspx') {
      if (r.request().method() !== 'POST')
        return r.fulfill({ contentType: 'text/html; charset=utf-8', body: GIRIS_FORMU() });
      const f = new URLSearchParams(r.request().postData() ?? '');
      v.girisler?.push(f);
      const no = f.get('lvergino') ?? '';
      if (v.ret?.includes(no))
        return r.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: GIRIS_FORMU('Girilen Bilgiler Hatalı Yapay Sağlayıcıyla İrtibata Geçin !'),
        });
      return r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<script>location.replace("${v.yol?.(no) ?? '/index.aspx'}?c=${no}")</script>`,
      });
    }
    if (yol === '/index.aspx') {
      const no = u.searchParams.get('c') ?? A;
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: odemeSayfasi(no, duzen(no)) });
    }
    return r.fulfill({ status: 404, body: '' });
  });
}
async function posuAc(p: Page, c: BrowserContext) {
  const yeni = c.waitForEvent('page');
  await p.getByRole('button', { name: 'Seçili kartla POS’u aç', exact: true }).click();
  const pos = await yeni;
  await pos.waitForLoadState('domcontentloaded');
  return pos;
}
async function tanit(pos: Page) {
  await expect(pos.locator('.ust')).toBeVisible();
  await panel(pos).getByRole('button', { name: 'Alanları tanıt', exact: true }).click();
  await kutu(pos, 'Kredi Kartı Numarası').click();
  await kutu(pos, 'S.K.T').click();
  await kutu(pos, 'Ad Soyad').click();
  await kutu(pos, 'CVV').click();
  await expect(panel(pos).getByRole('status')).toContainText('Alanlar tanıtıldı');
}

test('tek kurulum iki caride geçerli: kimliksiz kutular, fazladan satır, eksik e-posta, farklı adres', async () => {
  const e = await eklentiOrtami();
  try {
    await sahteSaglayici(e.c, (no) => ({ kimliksiz: true, ekSatir: no === B, epostaYok: no === B }), {
      yol: (no) => (no === B ? '/Index.aspx' : '/index.aspx'),
    });
    await yapayKartliCari(e.p, { ad: 'Yapay Cari A', numara: A, sahibi: 'YAPAY A' });
    const posA = await posuAc(e.p, e.c);
    await tanit(posA);
    await expect(kutu(posA, 'Kredi Kartı Numarası')).toHaveValue('4242424242424242');
    await expect(kutu(posA, 'Ad Soyad')).toHaveValue('YAPAY A');
    await yapayKartliCari(e.p, { ad: 'Yapay Cari B', numara: B, sahibi: 'YAPAY B' });
    await e.p.getByLabel('CVV (bu ödeme için, kaydedilmez)').fill('321');
    const posB = await posuAc(e.p, e.c);
    // Yeniden tanıtmadan doldurulur.
    await expect(kutu(posB, 'Kredi Kartı Numarası')).toHaveValue('4242424242424242');
    await expect(kutu(posB, 'S.K.T')).toHaveValue('12/35');
    await expect(kutu(posB, 'Ad Soyad')).toHaveValue('YAPAY B');
    await expect(kutu(posB, 'CVV')).toHaveValue('321');
    await expect(posB.locator('input.tutar')).toHaveValue('-1000,00');
    await expect(panel(posB)).toContainText('Kurulum tamam');
    // Eski A sekmesi yeni girişten haberdar edilir.
    await expect(panel(posA).getByRole('status')).toContainText('Başka sekmede yeni bir cariyle');
    // CVV hiçbir kalıcı veya geçici depoda kalmaz.
    const depo = await e.c.serviceWorkers()[0]?.evaluate(async () => {
      const ch = Reflect.get(globalThis, 'chrome');
      return JSON.stringify([await ch.storage.local.get(null), await ch.storage.session.get(null)]);
    });
    expect(depo).not.toMatch(/321|4242424242424242|10000000146/);
    const program = await e.p.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(program).not.toMatch(/"321"|4242/);
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('reddedilen girişte TC ipucu ve “Cariyi düzenle”; kartlı caride numara yalnız açık onayla düzelir', async () => {
  const e = await eklentiOrtami();
  try {
    await sahteSaglayici(e.c, () => ({}), { ret: [A] });
    await yapayKartliCari(e.p, { ad: 'Yapay Şahıs', numara: A });
    const pos = await posuAc(e.p, e.c);
    const hata = e.p.locator('#pos-aktarim-hatasi');
    await expect(hata).toContainText('POS girişi kabul edilmedi: “Girilen Bilgiler Hatalı');
    await expect(hata).toContainText('11 haneli TC');
    await pos.close();
    await e.p.getByRole('button', { name: 'Cariyi düzenle', exact: true }).first().click();
    await e.p.getByLabel('Vergi/TC numarası', { exact: true }).fill(B);
    await e.p.getByLabel('Cari adı ve numaranın aynı kişiye ait olduğunu kontrol ettim.').check();
    await e.p.getByRole('button', { name: 'Cariyi kaydet', exact: true }).click();
    await expect(e.p.locator('#pos-cari-hata')).toContainText('Numara düzeltmesinin');
    await e.p.getByLabel('Aynı kişinin numarasını düzeltiyorum; kartlar bu caride kalsın.').check();
    await e.p.getByRole('button', { name: 'Cariyi kaydet', exact: true }).click();
    await expect(e.p.locator('.pos-cari').filter({ hasText: 'Yapay Şahıs' })).toContainText('1 kayıtlı kart');
    await e.p.locator('.pos-odeme-karti').click();
    // Kurulum yokken açılan sekmede tanıtılır; düzeltilmiş numarayla giriş ve doldurma çalışır.
    const pos2 = await posuAc(e.p, e.c);
    await tanit(pos2);
    await expect(kutu(pos2, 'Kredi Kartı Numarası')).toHaveValue('4242424242424242');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('cariye özel lisans numarası ve şifre POS girişine gider', async () => {
  const e = await eklentiOrtami();
  try {
    const girisler: URLSearchParams[] = [];
    await sahteSaglayici(e.c, () => ({}), { girisler });
    await yapayKartliCari(e.p, { numara: A, kullanici: 'L77', sifre: 'yapay-sifre' });
    await posuAc(e.p, e.c);
    await expect.poll(() => girisler.length).toBe(1);
    expect([
      girisler[0]?.get('lvergino'),
      girisler[0]?.get('lkullaniciadi'),
      girisler[0]?.get('lsifre'),
    ]).toEqual([A, 'L77', 'yapay-sifre']);
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('yardımcı yeniden kurulunca program kurulumu geri verir; bilerek silinen kurulum geri gelmez', async () => {
  const e = await eklentiOrtami();
  try {
    await sahteSaglayici(e.c, () => ({}));
    await yapayKartliCari(e.p, { numara: A });
    const pos = await posuAc(e.p, e.c);
    await tanit(pos);
    await expect(kutu(pos, 'Kredi Kartı Numarası')).toHaveValue('4242424242424242');
    await pos.close();
    // Programın kopyası bir sonraki bağlantı denetiminde güncellenir.
    await e.p.getByRole('button', { name: 'Yardımcı bağlantısını kontrol et', exact: true }).click();
    await expect(e.p.getByRole('status').filter({ hasText: 'Ödeme formu tanıtılmış' })).toBeVisible();
    const w = e.c.serviceWorkers()[0];
    await w?.evaluate(async () => {
      await Reflect.get(globalThis, 'chrome').storage.local.clear();
    });
    const pos2 = await posuAc(e.p, e.c);
    await expect(kutu(pos2, 'Kredi Kartı Numarası')).toHaveValue('4242424242424242');
    await panel(pos2).getByRole('button', { name: 'Kurulumu sil', exact: true }).click();
    await panel(pos2).getByRole('button', { name: 'Evet, kurulumu sil', exact: true }).click();
    await expect(panel(pos2)).toContainText('Kurulum silindi');
    await pos2.close();
    await e.p.goto(APP + '#/sanal-pos');
    await e.p.locator('.pos-cari').first().click();
    await e.p.locator('.pos-odeme-karti').click();
    await e.p.getByRole('button', { name: 'Yardımcı bağlantısını kontrol et', exact: true }).click();
    await expect(e.p.getByRole('status').filter({ hasText: 'henüz tanıtılmamış' })).toBeVisible();
    const pos3 = await posuAc(e.p, e.c);
    await expect(panel(pos3)).toContainText('bir kez tanıtın');
    await expect(kutu(pos3, 'Kredi Kartı Numarası')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
