import { test, expect, type Page } from '@playwright/test';
import { eklentiOrtami, yapayKartliCari, kartliPosAc, POS } from './eklentiYardimci';

// Gerçek ödeme ekranına benzeyen YAPAY düzen: başlıklar kutuya bağlı <label> değil, ayrı yazı öğeleri.
// Kutu adları anlamsızdır (TextBoxN); tanıma yalnız yakındaki yazıyla veya açık onayla olabilir.
// ASP.NET gibi `name` içinde `$` taşır; bu işaret tutar/para birimi sayılmamalıdır.
function odeme(yakinYazi: boolean, yerTutucu = '') {
  return odemeGovdesi(yakinYazi, yerTutucu).replace(
    /<input id="(TextBox\d)"/g,
    '<input id="$1" name="ctl00$$Icerik$$$1"',
  );
}
function odemeGovdesi(yakinYazi: boolean, yerTutucu: string) {
  const baslik = (t: string) => (yakinYazi ? `<div class="baslik"><span>${t}</span></div>` : '');
  return `<!doctype html><body>
    <div class="ust">Firma İsmi : <span id="firma">YAPAY FİRMA (0123456789)</span></div>
    <div class="form">
      <div class="satir">${baslik('Ad Soyad')}<div><input id="TextBox1"></div></div>
      <div class="satir">${baslik('Kredi Kartı Numarası')}<div><input id="TextBox2"></div></div>
      ${yakinYazi ? '' : '<div class="etiketler"><span>S.K.T</span><span>CVV</span></div>'}
      <div class="ikili">
        <div class="sutun">${baslik('S.K.T')}<div><input id="TextBox3" placeholder="${yerTutucu}"></div></div>
        <div class="sutun">${baslik('CVV')}<div><input id="TextBox4"></div></div>
      </div>
      <div class="satir">${baslik('Tutar')}<div><input id="TextBox5" value="-1000,00"><span>TL</span></div></div>
      <button type="button">Ödeme İşlemine Devam Et</button>
    </div></body>`;
}
const panel = (p: Page) => p.locator('#cal-bup-pos-yardimcisi');
const durum = (p: Page) => panel(p).getByRole('status');
const evet = (p: Page) => panel(p).getByRole('button', { name: /^Evet/ });
const atla = (p: Page) => panel(p).getByRole('button', { name: 'Bu adımı atla', exact: true });

test('yakındaki yazılar tanınır; CVV yalnız CVV adımında, tutar hiçbir adımda kabul edilmez; firma kendiliğinden okunur', async () => {
  const e = await eklentiOrtami();
  try {
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({ contentType: 'text/html; charset=utf-8', body: odeme(true, 'MM / YY') }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Alanları tanıt', exact: true }).click();
    for (const yanlis of ['#TextBox5', '#TextBox4']) {
      await e.p.locator(yanlis).click();
      await expect(durum(e.p)).toContainText('CVV, tutar');
      await expect(evet(e.p)).toBeHidden();
    }
    await e.p.locator('#TextBox2').click();
    await e.p.locator('#TextBox4').click();
    await expect(durum(e.p)).toContainText('CVV, tutar');
    await e.p.locator('#TextBox3').click();
    await expect(durum(e.p)).toContainText('Ad Soyad');
    await e.p.locator('#TextBox1').click();
    await expect(durum(e.p)).toContainText('CVV kutusunu');
    await e.p.locator('#TextBox5').click();
    await expect(durum(e.p)).toContainText('tutar');
    await expect(evet(e.p)).toBeHidden();
    await e.p.locator('#TextBox4').click();
    // Firma yazısı “Firma İsmi … (numara)” kendiliğinden okunduğu için sorulmaz.
    await expect(durum(e.p)).toContainText('Alanlar tanıtıldı');
    await yapayKartliCari(e.p, { sahibi: 'YAPAY KİŞİ' });
    await e.p.getByLabel('CVV (bu ödeme için, kaydedilmez)').fill('987');
    const pos = await kartliPosAc(e.p, e.c);
    await expect(pos.locator('#TextBox2')).toHaveValue('4242424242424242');
    await expect(pos.locator('#TextBox3')).toHaveValue('12 / 35');
    await expect(pos.locator('#TextBox1')).toHaveValue('YAPAY KİŞİ');
    await expect(pos.locator('#TextBox4')).toHaveValue('987');
    await expect(pos.locator('#TextBox5')).toHaveValue('-1000,00');
    await expect(e.p.getByRole('status').filter({ hasText: 'CVV dolduruldu' })).toContainText(
      'Tutar kutusundaki',
    );
    await expect(e.p.getByLabel('CVV (bu ödeme için, kaydedilmez)')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('yazısı tanınmayan kutu nedeni gösterilerek yalnız açık onayla tanıtılır ve doldurulur', async () => {
  const e = await eklentiOrtami();
  try {
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({ contentType: 'text/html; charset=utf-8', body: odeme(false) }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Alanları tanıt', exact: true }).click();
    await e.p.locator('#TextBox2').click();
    await expect(durum(e.p)).toContainText('kart numarası olarak tanınmadı');
    await panel(e.p).getByRole('button', { name: 'Evet, bu kutu kart numarası kutusu', exact: true }).click();
    await e.p.locator('#TextBox3').click();
    await expect(durum(e.p)).toContainText('son kullanma (S.K.T) olarak tanınmadı');
    // “Hayır” onayı kaldırır; başka kutu seçilene kadar bir şey kaydedilmez.
    await panel(e.p).getByRole('button', { name: 'Hayır, başka kutu seçeceğim', exact: true }).click();
    await expect(evet(e.p)).toBeHidden();
    await e.p.locator('#TextBox3').click();
    await panel(e.p)
      .getByRole('button', { name: 'Evet, bu kutu son kullanma (S.K.T) kutusu', exact: true })
      .click();
    await atla(e.p).click();
    await atla(e.p).click();
    await expect(durum(e.p)).toContainText('Alanlar tanıtıldı');
    await yapayKartliCari(e.p);
    // CVV kutusu tanıtılmadıysa programda CVV sorulmaz.
    await expect(e.p.getByLabel('CVV (bu ödeme için, kaydedilmez)')).toHaveCount(0);
    const pos = await kartliPosAc(e.p, e.c);
    await expect(pos.locator('#TextBox2')).toHaveValue('4242424242424242');
    await expect(pos.locator('#TextBox3')).toHaveValue('12/35');
    for (const bos of ['#TextBox1', '#TextBox4']) await expect(pos.locator(bos)).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('elle onaylanan kutu sonradan CVV/tutar yazısı alırsa yine yazılmaz', async () => {
  const e = await eklentiOrtami();
  try {
    let sonra = false;
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: sonra
          ? odeme(false).replace('<input id="TextBox3"', '<input id="TextBox3" aria-label="CVV"')
          : odeme(false),
      }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Alanları tanıt', exact: true }).click();
    await e.p.locator('#TextBox2').click();
    await evet(e.p).click();
    await e.p.locator('#TextBox3').click();
    await evet(e.p).click();
    await atla(e.p).click();
    await atla(e.p).click();
    await expect(durum(e.p)).toContainText('Alanlar tanıtıldı');
    sonra = true;
    await yapayKartliCari(e.p);
    const pos = await kartliPosAc(e.p, e.c);
    await expect(e.p.locator('#pos-aktarim-hatasi')).not.toBeEmpty();
    await expect(pos.locator('#TextBox2')).toHaveValue('');
    await expect(pos.locator('#TextBox3')).toHaveValue('');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('tek S.K.T kutusu yıl için yeniden seçilemez; aynı kutuya ikinci tıklama açıkça söylenir', async () => {
  const e = await eklentiOrtami();
  try {
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({ contentType: 'text/html; charset=utf-8', body: odeme(true) }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Alanları tanıt', exact: true }).click();
    await e.p.locator('#TextBox2').click();
    await e.p.locator('#TextBox2').click();
    await expect(durum(e.p)).toContainText('Bu kutuyu zaten kart numarası olarak seçtiniz');
    await e.p.locator('#TextBox3').click();
    // Tek tarih kutusu: yardımcı ayrıca yıl sormaz, sıradaki adım Ad Soyad’dır.
    await expect(durum(e.p)).toContainText('Ad Soyad');
    await e.p.locator('#TextBox3').click();
    await expect(durum(e.p)).toContainText('zaten son kullanma (S.K.T) olarak seçtiniz');
    await expect(durum(e.p)).not.toContainText('Alan seçimi uygun değil');
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});

test('ekran yapısı raporu değer, rakam ve e-posta içermez', async () => {
  const e = await eklentiOrtami();
  try {
    await e.c.route(POS + '/yapay-odeme.aspx', (r) =>
      r.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: odeme(true).replace(
          '<div class="form">',
          '<div class="form"><input id="eposta" readonly value="yapay@ornek.test"><input type="hidden" name="__VIEWSTATE" value="gizli-durum-123">',
        ),
      }),
    );
    await e.p.goto(POS + '/yapay-odeme.aspx');
    await panel(e.p).getByRole('button', { name: 'Ekran yapısı raporu', exact: true }).click();
    const metin = await panel(e.p).getByRole('textbox', { name: 'Ekran yapısı raporu' }).inputValue();
    expect(metin).toContain('başlık="kredi karti numarasi"');
    expect(metin).toContain('Firma numarası kendiliğinden: okundu');
    expect(metin).toContain('gizli ad="__VIEWSTATE"');
    expect(metin).not.toMatch(/\d{3,}|yapay@|gizli-durum|1000|YAPAY FİRMA/);
    await panel(e.p).getByRole('button', { name: 'Raporu kapat', exact: true }).click();
    await expect(panel(e.p).getByRole('textbox', { name: 'Ekran yapısı raporu' })).toBeHidden();
    expect(e.sayac.sms + e.sayac.odeme + e.sayac.dis).toBe(0);
  } finally {
    await e.kapat();
  }
});
